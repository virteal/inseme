#!/usr/bin/env node

/**
 * Ingest Conseil markdowns (marie-corte_*) from public/docs/conseils
 * - Use the markdown files as the text source (no OCR)
 * - Reference canonical PDFs in public/docs/officiel in document_sources.metadata
 * - Chunk by heading/paragraph and insert knowledge_chunks with embeddings
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { loadConfig, getConfig, createSupabaseClient, createOpenAIClient } from "./lib/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger la configuration
await loadConfig();

const supabase = createSupabaseClient();
const openai = await createOpenAIClient();

const CONSEILS_DIR = path.join(__dirname, "..", "public", "docs", "conseils");
const OFFICIEL_DIR = path.join(__dirname, "..", "public", "docs", "officiel");
const PATTERN = /^mairie-corte_.*\.md$/i;

const MAX_TOKENS_PER_CHUNK = 1500;
const MAX_EMBEDDING_TOKENS = 8000;
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_BATCH_SIZE = 32;
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function hashText(text) {
  return crypto.createHash("sha256").update(normalizeText(text)).digest("hex");
}

async function generateEmbeddings(texts, retry = 0) {
  if (!Array.isArray(texts)) texts = [texts];
  const totalTokens = texts.reduce((s, t) => s + estimateTokens(t), 0);
  if (totalTokens > MAX_EMBEDDING_TOKENS) throw new Error("Batch exceeds token limit");

  try {
    const resp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return resp.data.map((d) => d.embedding);
  } catch (err) {
    if (retry < 3) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retry)));
      return generateEmbeddings(texts, retry + 1);
    }
    throw err;
  }
}

function chunkMarkdown(content) {
  const sections = content.split(/^#+\s+/m).filter((s) => s && s.trim());
  const chunks = [];
  let current = "";
  let currentTokens = 0;

  for (const section of sections) {
    const tokens = estimateTokens(section);
    if (current && currentTokens + tokens > MAX_TOKENS_PER_CHUNK) {
      chunks.push(current.trim());
      current = "";
      currentTokens = 0;
    }
    current += section + "\n\n";
    currentTokens += tokens;
  }
  if (current.trim()) chunks.push(current.trim());

  // Ensure none exceed limit; split by paragraphs if needed. If no paragraph breaks,
  // fall back to fixed-size character windows with overlap to avoid huge chunks.
  const final = [];
  const charLimit = MAX_TOKENS_PER_CHUNK * 4; // approximate characters per chunk
  const overlapChars = 200;

  for (const c of chunks) {
    if (estimateTokens(c) <= MAX_TOKENS_PER_CHUNK) {
      final.push(c);
      continue;
    }

    const paras = c.split(/\n\n+/).filter((p) => p.trim());
    if (paras.length > 0) {
      let pcur = "";
      let ptokens = 0;
      for (const p of paras) {
        const t = estimateTokens(p);
        if (pcur && ptokens + t > MAX_TOKENS_PER_CHUNK) {
          final.push(pcur.trim());
          pcur = "";
          ptokens = 0;
        }
        pcur += p + "\n\n";
        ptokens += t;
      }
      if (pcur.trim()) final.push(pcur.trim());
    } else {
      // No paragraph separators: split by char windows
      let start = 0;
      while (start < c.length) {
        const end = Math.min(c.length, start + charLimit);
        const piece = c.slice(start, end);
        final.push(piece.trim());
        // advance with overlap
        const nextStart = end - overlapChars;
        start = nextStart > start ? nextStart : end;
      }
    }
  }

  return final;
}

async function findCanonicalPdf(mdFilename) {
  const base = mdFilename.replace(/\.md$/i, "");
  const candidates = [base + ".pdf", base.replace(/\.md$/i, "") + ".pdf"];
  for (const c of candidates) {
    const p = path.join(OFFICIEL_DIR, c);
    try {
      await fs.access(p);
      return p;
    } catch (e) {
      // continue
    }
  }
  return null;
}

async function upsertSourceForMarkdown(filePath, canonicalPdfPath, content, metadata) {
  const filename = path.basename(filePath);
  const externalId = `conseil:${filename}`;
  const contentHash = hashText(content);
  const stats = await fs.stat(filePath);

  const sourceData = {
    external_id: externalId,
    filename: filename,
    content_hash: contentHash,
    public_url: `file://${filePath}`,
    file_size_bytes: stats.size,
    mime_type: "text/markdown",
    domain: "local_government",
    source_type: "conseil_doc",
    metadata: {
      title: metadata.title || filename,
      published_date: metadata.date || null,
      canonical_pdf_path: canonicalPdfPath
        ? path.relative(path.join(__dirname, ".."), canonicalPdfPath)
        : null,
    },
    ingestion_method: "cli_bulk",
    status: "active",
  };

  // Check existing
  const { data: existing } = await supabase
    .from("document_sources")
    .select("id,content_hash")
    .eq("external_id", externalId)
    .single();
  if (existing && existing.content_hash === contentHash && !FORCE) {
    return { id: existing.id, changed: false };
  }

  if (existing) {
    const { data, error } = await supabase
      .from("document_sources")
      .update(sourceData)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, changed: true };
  }

  const { data, error } = await supabase
    .from("document_sources")
    .insert(sourceData)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, changed: true };
}

async function chunkExists(textHash, sourceType = "conseil_doc") {
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id")
    .eq("text_hash", textHash)
    .eq("source_type", sourceType)
    .single();
  return !!data;
}

async function insertChunks(sourceId, chunks, title, metaCommon) {
  if (chunks.length === 0) return 0;
  let inserted = 0;

  // Prepare batches
  const batches = [];
  let cur = [];
  let curTokens = 0;
  for (const c of chunks) {
    const t = estimateTokens(c);
    if (cur.length >= EMBEDDING_BATCH_SIZE || curTokens + t > MAX_EMBEDDING_TOKENS) {
      if (cur.length) {
        batches.push(cur);
        cur = [];
        curTokens = 0;
      }
    }
    cur.push(c);
    curTokens += t;
  }
  if (cur.length) batches.push(cur);

  for (const batch of batches) {
    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would generate embeddings for ${batch.length} chunks`);
      inserted += batch.length;
      continue;
    }

    const embeddings = await generateEmbeddings(batch);
    const inserts = [];
    for (let i = 0; i < batch.length; i++) {
      const text = batch[i];
      const textHash = hashText(text);
      if (await chunkExists(textHash)) {
        console.log("    Chunk exists, skipping");
        continue;
      }
      inserts.push({
        source_id: sourceId,
        text: text,
        text_hash: textHash,
        embedding: JSON.stringify(embeddings[i]),
        type: "fact",
        status: "confirmed",
        source_type: "conseil_doc",
        domain: "local_government",
        layer: "hot",
        metadata: { ...metaCommon },
      });
    }

    if (inserts.length === 0) continue;
    const { error } = await supabase.from("knowledge_chunks").insert(inserts);
    if (error) throw error;
    inserted += inserts.length;
    console.log(`    Inserted ${inserts.length} chunks`);
  }

  return inserted;
}

function extractMetaFromFilename(filename) {
  const meta = {};
  const dateMatch = filename.match(/(\d{4})[-_]?([0-1]\d)[-_]?(\d{2})/);
  if (dateMatch) meta.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  meta.title = filename.replace(/\.md$/i, "").replace(/_/g, " ");
  return meta;
}

async function main() {
  const args = process.argv.slice(2);
  let limit = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") limit = parseInt(args[++i] || "0", 10);
  }

  console.log("Ingest conseils (markdown-only). DRY_RUN:", DRY_RUN, "FORCE:", FORCE);

  let files = [];
  try {
    const dirents = await fs.readdir(CONSEILS_DIR, { withFileTypes: true });
    for (const d of dirents) {
      if (d.isFile() && PATTERN.test(d.name)) files.push(path.join(CONSEILS_DIR, d.name));
    }
  } catch (err) {
    console.error("Error reading conseils dir:", err.message);
    process.exit(1);
  }

  files.sort();
  if (limit && limit > 0) files = files.slice(0, limit);
  console.log(`Found ${files.length} markdown files to process`);

  let totalInserted = 0;
  for (const f of files) {
    try {
      console.log("\nProcessing:", f);
      const content = await fs.readFile(f, "utf-8");
      const filename = path.basename(f);
      const meta = extractMetaFromFilename(filename);
      const canonicalPdf = await findCanonicalPdf(filename);
      console.log(
        "  canonical PDF:",
        canonicalPdf ? path.relative(path.join(__dirname, ".."), canonicalPdf) : "none"
      );

      const { id: sourceId, changed } = await upsertSourceForMarkdown(
        f,
        canonicalPdf,
        content,
        meta
      );
      if (!changed) {
        console.log("  Source unchanged, skipping chunks");
        continue;
      }

      const chunks = chunkMarkdown(content);
      console.log(`  Chunked into ${chunks.length} pieces`);

      const metaCommon = {
        document_title: meta.title,
        document_date: meta.date || null,
        canonical_pdf_path: canonicalPdf
          ? path.relative(path.join(__dirname, ".."), canonicalPdf)
          : null,
        language: "fr",
      };

      const inserted = await insertChunks(sourceId, chunks, meta.title, metaCommon);
      totalInserted += inserted;
      console.log(`  Inserted ${inserted} chunks for ${filename}`);
    } catch (err) {
      console.error("  Error processing file:", err.message);
    }
  }

  console.log(`\nDone. Total chunks inserted: ${totalInserted}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
