#!/usr/bin/env node

/**
 * Single File Ingestion Script for Ophélia RAG
 *
 * Processes a single markdown/text file into knowledge chunks:
 * - Intelligent chunking by sections/paragraphs
 * - Vector embeddings (OpenAI text-embedding-3-small)
 * - Deduplication via text_hash
 * - Document source tracking
 */

import fs from "fs/promises";
import path from "path";
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

// ============================================================================
// Chunking Logic for Markdown
// ============================================================================

/**
 * Split markdown content into chunks based on sections and token count
 */
function chunkMarkdown(content, title) {
  // Split by major sections (headers)
  const sections = content.split(/^#+\s+/m).filter((s) => s.trim());

  const chunks = [];
  let currentChunk = "";
  let currentTokens = 0;
  let partNumber = 1;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section);

    // If adding this section exceeds limit and we have content, flush
    if (currentTokens + sectionTokens > MAX_TOKENS_PER_CHUNK && currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        part: partNumber,
        total: null, // Will be updated later
      });
      currentChunk = "";
      currentTokens = 0;
      partNumber++;
    }

    currentChunk += section + "\n\n";
    currentTokens += sectionTokens;
  }

  // Add last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      part: partNumber,
      total: null,
    });
  }

  // If still too large, split by paragraphs
  const finalChunks = [];
  for (const chunk of chunks) {
    if (estimateTokens(chunk.text) <= MAX_TOKENS_PER_CHUNK) {
      finalChunks.push(chunk);
    } else {
      // Split by paragraphs
      const paragraphs = chunk.text.split(/\n\n+/).filter((p) => p.trim());
      let paraChunk = "";
      let paraTokens = 0;
      let paraPart = 1;

      for (const para of paragraphs) {
        const pTokens = estimateTokens(para);

        if (paraTokens + pTokens > MAX_TOKENS_PER_CHUNK && paraChunk) {
          finalChunks.push({
            text: paraChunk.trim(),
            part: paraPart,
            total: null,
          });
          paraChunk = "";
          paraTokens = 0;
          paraPart++;
        }

        paraChunk += para + "\n\n";
        paraTokens += pTokens;
      }

      if (paraChunk.trim()) {
        finalChunks.push({
          text: paraChunk.trim(),
          part: paraPart,
          total: null,
        });
      }

      // Update totals for paragraph chunks
      const totalParas = finalChunks.length - (chunks.length - 1) + (paraPart - 1);
      for (let i = finalChunks.length - paraPart + 1; i < finalChunks.length; i++) {
        finalChunks[i].total = totalParas;
      }
    }
  }

  // Update total count
  const totalParts = finalChunks.length;
  finalChunks.forEach((chunk) => {
    if (chunk.total === null) chunk.total = totalParts;
  });

  return finalChunks;
}

/**
 * Build formatted chunk text with header
 */
function buildChunkText(title, chunkContent, chunkPart) {
  let text = `TYPE: fact
STATUT: confirmed
SOURCE: Fiche Identité Corte - Rapport civique complet`;

  if (title) {
    text += `\nDOCUMENT: ${title}${chunkPart ? ` (Partie ${chunkPart.part}/${chunkPart.total})` : ""}`;
  }

  text += "\n\n";

  // Add title for context
  if (title && chunkPart) {
    text += `${title}\n\n`;
  }

  text += chunkContent;

  return text;
}

// ============================================================================
// Document Source Management
// ============================================================================

/**
 * Create or update document source for the file
 */
async function upsertDocumentSource(filePath, content, title) {
  const filename = path.basename(filePath);
  const externalId = `file:${filename}`;

  // Calculate content hash
  const contentHash = hashText(content);

  // Check if source exists
  const { data: existing } = await supabase
    .from("document_sources")
    .select("id, content_hash")
    .eq("external_id", externalId)
    .single();

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
  const stats = await fs.stat(filePath);
  const sourceData = {
    external_id: externalId,
    filename: filename,
    content_hash: contentHash,
    public_url: `file://${filePath}`, // Local file URL
    file_size_bytes: stats.size,
    mime_type: "text/markdown",
    domain: "history",
    source_type: "history",
    metadata: {
      title: title || filename,
      type: "civic_report",
      description: "Rapport civique complet sur la ville de Corte",
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
    // Insert new
    const { data, error } = await supabase
      .from("document_sources")
      .insert(sourceData)
      .select("id")
      .single();

    if (error) throw error;
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
async function insertChunk(sourceId, chunkText, chunkPart, title) {
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
  const meta = {
    document_title: title,
    type: "civic_report",
    source: "Fiche Identité Corte",
  };

  if (chunkPart) {
    meta.chunk_part = {
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
    metadata: meta,
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
 * Process a single file
 */
async function processFile(filePath) {
  console.log(`\n📄 Processing file: ${filePath}`);

  // Read file
  const content = await fs.readFile(filePath, "utf-8");
  const title = "Fiche Identité Corte - Rapport civique complet";

  // 1. Upsert document source
  const { id: sourceId, changed } = await upsertDocumentSource(filePath, content, title);

  // 2. If source unchanged, skip chunking
  if (!changed) {
    console.log(`  ⏭️  Skipping (source unchanged)`);
    return { processed: false, chunks: 0 };
  }

  // 3. Chunk the content
  const chunks = chunkMarkdown(content, title);
  console.log(`  📦 Chunks: ${chunks.length}`);

  // 4. Process chunks: check deduplication, collect for embedding
  const newChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkPart = chunk.total > 1 ? { part: chunk.part, total: chunk.total } : null;
    const chunkText = buildChunkText(title, chunk.text, chunkPart);
    const textHash = hashText(chunkText);

    if (await chunkExists(textHash, "history")) {
      console.log(`  🔹 Chunk ${i + 1}/${chunks.length}: already exists`);
      continue;
    }

    const meta = {
      document_title: title,
      type: "civic_report",
      source: "Fiche Identité Corte",
    };

    if (chunkPart) {
      meta.chunk_part = {
        part: chunkPart.part,
        total: chunkPart.total,
      };
    }

    newChunks.push({ chunkText, textHash, meta });
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
          metadata: nc.meta,
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

  console.log(`  ✅ Done (${insertedCount}/${chunks.length} new chunks)`);
  return { processed: true, chunks: insertedCount };
}

/**
 * Main function
 */
async function main() {
  console.log("╭─────────────────────────────────────────────────────╮");
  console.log("│  Single File → Knowledge Chunks Ingestion          │");
  console.log("╰─────────────────────────────────────────────────────╯\n");

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No data will be inserted\n");
  }

  // Get file path from arguments
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("❌ Error: Please provide a file path as argument");
    console.log("Usage: node scripts/ingest_file.js <file_path> [--dry-run] [--force]");
    process.exit(1);
  }

  // Check if file exists
  try {
    await fs.access(filePath);
  } catch {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Process the file
  try {
    const result = await processFile(filePath);

    // Summary
    console.log("\n╭─────────────────────────────────────────────────────╮");
    console.log("│  Ingestion Summary                                  │");
    console.log("╰─────────────────────────────────────────────────────╯\n");
    console.log(`File processed:    ${filePath}`);
    console.log(`Chunks created:    ${result.chunks}`);
    console.log("");
  } catch (error) {
    console.error("\n💥 Error processing file:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
