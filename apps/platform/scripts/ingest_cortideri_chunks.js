#!/usr/bin/env node

/**
 * Cortideri to Knowledge Chunks Ingestion Script
 *
 * Transforms cortideri_items into knowledge_chunks with:
 * - Intelligent chunking (splits long articles by paragraphs)
 * - Vector embeddings (OpenAI text-embedding-3-small)
 * - Deduplication via text_hash
 * - Append-only architecture
 */

import crypto from "crypto";
import { loadConfig, createSupabaseClient, createOpenAIClient } from "./lib/config.js";

// Charger la configuration
await loadConfig();

// ============================================================================
// Configuration
// ============================================================================

const supabase = createSupabaseClient();
const openai = await createOpenAIClient();

const MAX_TOKENS_PER_CHUNK = 1500;
const MAX_EMBEDDING_TOKENS = 8000; // OpenAI limit is 8191
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const EMBEDDING_BATCH_SIZE = 20;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Normalize text for hashing (remove extra whitespace, lowercase)
 */
function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Calculate SHA-256 hash of text
 */
function hashText(text) {
  return crypto.createHash("sha256").update(normalizeText(text)).digest("hex");
}

/**
 * Generate embeddings for texts using OpenAI (with retry logic)
 */
async function generateEmbeddings(texts, retryCount = 0) {
  if (!Array.isArray(texts)) {
    texts = [texts]; // backward compatibility
  }

  // Validate each chunk size
  for (const text of texts) {
    const tokens = estimateTokens(text);
    if (tokens > MAX_EMBEDDING_TOKENS) {
      throw new Error(
        `Chunk too large for embedding: ${tokens} tokens (max ${MAX_EMBEDDING_TOKENS}). ` +
          `This should not happen with MAX_TOKENS_PER_CHUNK=${MAX_TOKENS_PER_CHUNK}.`
      );
    }
  }

  // Check total tokens
  const totalTokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0);
  if (totalTokens > MAX_EMBEDDING_TOKENS) {
    throw new Error(`Batch too large: ${totalTokens} tokens (max ${MAX_EMBEDDING_TOKENS})`);
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embeddings = response.data.map((d) => d.embedding);

    // Validate each embedding dimensions
    for (const embedding of embeddings) {
      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Invalid embedding: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding?.length || "undefined"}`
        );
      }
    }

    return embeddings;
  } catch (error) {
    console.error(
      `Error generating embeddings (attempt ${retryCount + 1}/${MAX_RETRIES}):`,
      error.message
    );

    // Retry on rate limit or temporary errors
    if (retryCount < MAX_RETRIES - 1) {
      const isRetryable =
        error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 503 || // Service unavailable
        error.code === "ECONNRESET" || // Connection reset
        error.code === "ETIMEDOUT"; // Timeout

      if (isRetryable) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
        console.log(`  Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return generateEmbeddings(texts, retryCount + 1);
      }
    }

    throw error;
  }
}

/**
 * Get category name from ID (you can expand this mapping)
 */
function getCategoryName(categoryId) {
  const categories = {
    1: "Actualités",
    2: "Politique",
    3: "Histoire",
    4: "Culture",
    5: "Sport",
  };
  return categories[categoryId] || `Catégorie ${categoryId}`;
}

// ============================================================================
// Chunking Logic
// ============================================================================

/**
 * Split article into chunks based on token count
 */
function chunkArticle(article) {
  const contentText = article.content_text || "";
  const tokens = estimateTokens(contentText);

  // Short article: single chunk
  if (tokens <= MAX_TOKENS_PER_CHUNK) {
    return [
      {
        text: contentText,
        part: null,
        total: 1,
      },
    ];
  }

  // Long article: split by paragraphs
  const paragraphs = contentText.split(/\n\n+/).filter((p) => p.trim());
  const chunks = [];
  let currentChunk = "";
  let currentTokens = 0;
  let partNumber = 1;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // If adding this paragraph exceeds limit and we have content, flush
    if (currentTokens + paraTokens > MAX_TOKENS_PER_CHUNK && currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        part: partNumber,
        total: null, // Will be updated later
      });
      currentChunk = "";
      currentTokens = 0;
      partNumber++;
    }

    currentChunk += para + "\n\n";
    currentTokens += paraTokens;
  }

  // Add last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      part: partNumber,
      total: null,
    });
  }

  // Update total count
  const totalParts = chunks.length;
  chunks.forEach((chunk) => {
    chunk.total = totalParts;
  });

  return chunks;
}

/**
 * Build formatted chunk text with header
 */
function buildChunkText(article, chunkContent, chunkPart) {
  const categoryName = getCategoryName(article.category_id);
  const partInfo = chunkPart ? ` (Partie ${chunkPart.part}/${chunkPart.total})` : "";

  let text = `TYPE: fact
STATUT: confirmed
SOURCE: Corti d'Eri - ${categoryName}`;

  if (article.title) {
    text += `\nARTICLE: ${article.title}${partInfo}`;
  }

  text += "\n\n";

  // Add title for context (especially important for multi-part chunks)
  if (article.title && chunkPart) {
    text += `${article.title}\n\n`;
  }

  text += chunkContent;

  if (article.tags && article.tags.length > 0) {
    text += `\n\nTAGS: ${article.tags.join(", ")}`;
  }

  return text;
}

// ============================================================================
// Document Sources Management
// ============================================================================

/**
 * Create or update document source
 */
async function upsertDocumentSource(article) {
  const externalId = `cortideri:${article.post_id}`;

  // Check if source exists by external_id (primary lookup)
  const { data: existing } = await supabase
    .from("document_sources")
    .select("id, content_hash")
    .eq("external_id", externalId)
    .single();

  // Calculate content hash
  const contentHash = hashText(article.content_text || "");

  // If exists and unchanged, return existing ID
  if (existing && existing.content_hash === contentHash) {
    if (FORCE) {
      console.log(`  Source forced update: ${externalId}`);
      return { id: existing.id, changed: true };
    } else {
      console.log(`  Source unchanged: ${externalId}`);
      return { id: existing.id, changed: false };
    }
  }

  // Prepare source data
  const sourceData = {
    external_id: externalId,
    filename: `cortideri_${article.post_id}.txt`,
    content_hash: contentHash,
    public_url: article.url || `http://cortideri.fr/?p=${article.post_id}`,
    file_size_bytes: (article.content_text || "").length,
    mime_type: "text/plain",
    domain: "history",
    source_type: "history",
    metadata: {
      title: article.title,
      category_id: article.category_id,
      category_name: getCategoryName(article.category_id),
      tags: article.tags || [],
      post_id: article.post_id,
      has_images: (article.image_urls || []).length > 0,
    },
    ingestion_method: "cli_bulk",
    status: "active",
  };

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from("document_sources")
      .update(sourceData)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) throw error;
    console.log(`  Source updated: ${externalId}`);
    return { id: data.id, changed: true };
  } else {
    // Insert new (may have duplicate content_hash, that's OK)
    const { data, error } = await supabase
      .from("document_sources")
      .insert(sourceData)
      .select("id")
      .single();

    if (error) {
      // If it's a duplicate content_hash error, that's a data issue but not critical
      if (error.code === "23505" && error.message.includes("content_hash")) {
        console.warn(
          `  ⚠️  Duplicate content detected for ${externalId} (same as another article)`
        );
        // Try to find the existing one by content_hash and use it
        const { data: duplicate } = await supabase
          .from("document_sources")
          .select("id")
          .eq("content_hash", contentHash)
          .limit(1)
          .single();

        if (duplicate) {
          console.log(`  Using existing source with same content: ${duplicate.id}`);
          return { id: duplicate.id, changed: false };
        }
      }
      throw error;
    }

    console.log(`  Source created: ${externalId}`);
    return { id: data.id, changed: true };
  }
}

// ============================================================================
// Knowledge Chunks Management
// ============================================================================

/**
 * Check if chunk already exists
 */
async function chunkExists(textHash, sourceType) {
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id")
    .eq("text_hash", textHash)
    .eq("source_type", sourceType)
    .single();

  return !!data;
}

/**
 * Insert knowledge chunk
 */
async function insertChunk(sourceId, article, chunkText, chunkPart) {
  const textHash = hashText(chunkText);

  // Check if chunk already exists (deduplication)
  if (await chunkExists(textHash, "history")) {
    console.log(`    Chunk already exists (hash: ${textHash.substring(0, 16)}...)`);
    return { skipped: true };
  }

  // Generate embedding
  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would generate embedding (${estimateTokens(chunkText)} tokens)`);
    return { skipped: true, dryRun: true };
  }

  console.log(`    Generating embedding...`);
  const embedding = (await generateEmbeddings([chunkText]))[0];

  // Prepare metadata
  const metadata = {
    article_id: `cortideri:${article.post_id}`,
    category_id: article.category_id,
    category_name: getCategoryName(article.category_id),
    tags: article.tags || [],
    url: article.url || `http://cortideri.fr/?p=${article.post_id}`,
    has_images: (article.image_urls || []).length > 0,
  };

  if (chunkPart) {
    metadata.chunk_part = {
      part: chunkPart.part,
      total: chunkPart.total,
    };
  }

  // Insert chunk
  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would insert chunk into knowledge_chunks`);
    return { skipped: false, dryRun: true };
  }

  const { error } = await supabase.from("knowledge_chunks").insert({
    source_id: sourceId,
    text: chunkText,
    text_hash: textHash,
    embedding: JSON.stringify(embedding), // Supabase expects JSON string for vector
    type: "fact",
    status: "confirmed",
    source_type: "history",
    domain: "history",
    info_date: null, // Could extract from content later
    layer: "hot",
    metadata: metadata,
  });

  if (error) {
    console.error(`    Error inserting chunk:`, error.message);
    throw error;
  }

  console.log(`    Chunk inserted (${estimateTokens(chunkText)} tokens)`);
  return { skipped: false };
}

// ============================================================================
// Main Ingestion
// ============================================================================

/**
 * Process a single article
 */
async function processArticle(article) {
  console.log(`\n📄 Processing: ${article.title || `Post ${article.post_id}`}`);

  // 1. Upsert document source
  const { id: sourceId, changed } = await upsertDocumentSource(article);

  // 2. If source unchanged, skip chunking
  if (!changed) {
    console.log(`  ⏭️  Skipping (source unchanged)`);
    return { processed: false, chunks: 0 };
  }

  // 3. Chunk the article
  const chunks = chunkArticle(article);
  console.log(`  📦 Chunks: ${chunks.length}`);

  // 4. Process chunks: check deduplication, collect for embedding
  const newChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkPart = chunk.total > 1 ? { part: chunk.part, total: chunk.total } : null;
    const chunkText = buildChunkText(article, chunk.text, chunkPart);
    const textHash = hashText(chunkText);

    if (await chunkExists(textHash, "history")) {
      console.log(`  🔹 Chunk ${i + 1}/${chunks.length}: already exists`);
      continue;
    }

    const metadata = {
      article_id: `cortideri:${article.post_id}`,
      category_id: article.category_id,
      category_name: getCategoryName(article.category_id),
      tags: article.tags || [],
      url: article.url || `http://cortideri.fr/?p=${article.post_id}`,
      has_images: (article.image_urls || []).length > 0,
    };

    if (chunkPart) {
      metadata.chunk_part = {
        part: chunkPart.part,
        total: chunkPart.total,
      };
    }

    newChunks.push({ chunkText, textHash, metadata: metadata });
    console.log(`  🔹 Chunk ${i + 1}/${chunks.length}: queued for embedding`);
  }

  // 5. Batch generate embeddings and insert
  let insertedCount = 0;
  if (newChunks.length > 0) {
    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would generate embeddings and insert ${newChunks.length} chunks`);
      insertedCount = newChunks.length;
    } else {
      // Split into batches respecting size and token limits
      const batches = [];
      let currentBatch = [];
      let currentTokens = 0;

      for (const nc of newChunks) {
        const tokens = estimateTokens(nc.chunkText);
        if (
          currentBatch.length >= EMBEDDING_BATCH_SIZE ||
          currentTokens + tokens > MAX_EMBEDDING_TOKENS
        ) {
          if (currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [];
            currentTokens = 0;
          }
        }
        currentBatch.push(nc);
        currentTokens += tokens;
      }
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      console.log(`    Processing ${batches.length} embedding batch(es)...`);

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        console.log(`    Batch ${b + 1}/${batches.length}: ${batch.length} chunks`);

        const texts = batch.map((nc) => nc.chunkText);
        const embeddings = await generateEmbeddings(texts);

        const chunkInserts = batch.map((nc, i) => ({
          source_id: sourceId,
          text: nc.chunkText,
          text_hash: nc.textHash,
          embedding: JSON.stringify(embeddings[i]),
          type: "fact",
          status: "confirmed",
          source_type: "history",
          domain: "history",
          info_date: null,
          layer: "hot",
          metadata: nc.metadata,
        }));

        const { error } = await supabase.from("knowledge_chunks").insert(chunkInserts);

        if (error) {
          console.error(`    Error inserting batch ${b + 1}:`, error.message);
          throw error;
        }

        insertedCount += batch.length;
      }

      console.log(`    Total inserted: ${insertedCount} chunks`);
    }
  }

  let failedCount = 0;

  // 5. Update synced_at in cortideri_items
  await supabase
    .from("cortideri_items")
    .update({ source_id: sourceId, synced_at: new Date().toISOString() })
    .eq("post_id", article.post_id);

  console.log(
    `  ✅ Done (${insertedCount}/${chunks.length} new chunks${failedCount > 0 ? `, ${failedCount} failed` : ""})`
  );
  return { processed: true, chunks: insertedCount, failed: failedCount };
}

/**
 * Main function
 */
async function main() {
  console.log("╭─────────────────────────────────────────────────────╮");
  console.log("│  Cortideri → Knowledge Chunks Ingestion            │");
  console.log("╰─────────────────────────────────────────────────────╯\n");

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No data will be inserted\n");
  }

  // Fetch all cortideri items
  const { data: articles, error } = await supabase
    .from("cortideri_items")
    .select("*")
    .order("post_id", { ascending: true });

  if (error) {
    console.error("❌ Error fetching articles:", error.message);
    process.exit(1);
  }

  console.log(`📚 Found ${articles.length} articles\n`);

  // Process each article
  const stats = {
    total: articles.length,
    processed: 0,
    skipped: 0,
    totalChunks: 0,
    failedChunks: 0,
  };

  for (const article of articles) {
    try {
      const result = await processArticle(article);
      if (result.processed) {
        stats.processed++;
        stats.totalChunks += result.chunks;
        stats.failedChunks += result.failed || 0;
      } else {
        stats.skipped++;
      }
    } catch (error) {
      console.error(`❌ Error processing article ${article.post_id}:`, error.message);
      stats.skipped++;
    }
  }

  // Summary
  console.log("\n╭─────────────────────────────────────────────────────╮");
  console.log("│  Ingestion Summary                                  │");
  console.log("╰─────────────────────────────────────────────────────╯\n");
  console.log(`Total articles:     ${stats.total}`);
  console.log(`Processed:          ${stats.processed}`);
  console.log(`Skipped:            ${stats.skipped}`);
  console.log(`Total chunks:       ${stats.totalChunks}`);
  if (stats.failedChunks > 0) {
    console.log(`⚠️  Failed chunks:    ${stats.failedChunks}`);
  }
  console.log("");
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
