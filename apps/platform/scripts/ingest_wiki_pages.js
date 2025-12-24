#!/usr/bin/env node

// Wiki ingestion: chunks `wiki_pages` to `knowledge_chunks`
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { loadConfig, getConfig, createSupabaseClient, createOpenAIClient } from "./lib/config.js";

// Charger la configuration
await loadConfig();

const supabase = createSupabaseClient();
const openai = await createOpenAIClient();
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH_SIZE = 20;
const MAX_TOKENS_PER_CHUNK = 1500;
const MAX_EMBEDDING_TOKENS = 8000;
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run") || getConfig("dry_run") === "1";
const FORCE = argv.includes("--force");
const RECURSIVE = argv.includes("--recursive");
const LIMIT_IDX = argv.indexOf("--limit");
const LIMIT = LIMIT_IDX !== -1 ? Number(argv[LIMIT_IDX + 1]) : undefined;
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
  const total = texts.reduce((s, t) => s + estimateTokens(t), 0);
  if (total > MAX_EMBEDDING_TOKENS) throw new Error("Batch too large");
  try {
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
    return res.data.map((d) => d.embedding);
  } catch (e) {
    if (retry < 3) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retry)));
      return generateEmbeddings(texts, retry + 1);
    }
    throw e;
  }
}
function chunkMarkdown(content) {
  const sections = content.split(/^#+\s+/m).filter(Boolean);
  const chunks = [];
  let buf = "";
  for (const s of sections) {
    const t = estimateTokens(s);
    if (estimateTokens(buf) + t > MAX_TOKENS_PER_CHUNK && buf) {
      chunks.push(buf.trim());
      buf = "";
    }
    buf += s + "\n\n";
  }
  if (buf.trim()) chunks.push(buf.trim());
  const final = [];
  for (const c of chunks) {
    if (estimateTokens(c) <= MAX_TOKENS_PER_CHUNK) final.push(c);
    else {
      const paras = c.split(/\n\n+/).filter(Boolean);
      let pbuf = "";
      for (const p of paras) {
        if (estimateTokens(pbuf) + estimateTokens(p) > MAX_TOKENS_PER_CHUNK && pbuf) {
          final.push(pbuf.trim());
          pbuf = "";
        }
        pbuf += p + "\n\n";
      }
      if (pbuf.trim()) final.push(pbuf.trim());
    }
  }
  return final;
}
async function upsertSource(slug, filePath, content, title, extraMeta = {}, fromDb = false) {
  // DRY_RUN: skip remote DB writes and return a placeholder
  if (DRY_RUN) {
    const content_hash = hashText(content);
    console.log(
      `[DRY RUN] Would upsert document_source: ${slug} (hash: ${content_hash.substring(0, 8)}...)`
    );
    return { id: `dry:${slug}`, changed: true };
  }
  const external_id = `wiki:${slug}`;
  const content_hash = hashText(content);
  const { data: existing, error: existingError } = await supabase
    .from("document_sources")
    .select("id,content_hash")
    .eq("external_id", external_id)
    .maybeSingle();
  if (existingError) {
    console.error("Error checking existing document_source for", external_id);
    throw existingError;
  }
  // Only include the title and a lightweight ID in document_sources.metadata.
  // Page-level metadata (author, timestamps, full page metadata) remains in chunk.metadata.
  const srcMeta = { title: title || slug };
  if (fromDb && extraMeta && extraMeta.page_id) srcMeta.page_id = extraMeta.page_id;
  const sourceData = {
    external_id,
    filename: path.basename(filePath),
    content_hash,
    public_url: filePath?.startsWith("file://")
      ? `file://${filePath}`
      : filePath || `supabase://wiki_pages/${slug}`,
    file_size_bytes: Buffer.byteLength(content, "utf8"),
    mime_type: "text/markdown",
    domain: "wiki",
    source_type: "wiki_page",
    metadata: srcMeta,
    ingestion_method: "cli_bulk",
    status: "active",
  };
  if (existing) {
    if (!FORCE && existing.content_hash === content_hash)
      return { id: existing.id, changed: false };
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
async function chunkExists(text_hash, sourceType = "wiki_page") {
  if (DRY_RUN) {
    return false;
  }
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("id")
    .eq("text_hash", text_hash)
    .eq("source_type", sourceType)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Error while checking chunk existence.");
    throw error;
  }
  return !!data;
}
async function insertChunks(sourceId, chunks) {
  if (!chunks || chunks.length === 0) return { inserted: 0 };
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would insert ${chunks.length} chunk(s) for source ${sourceId}`);
    for (const c of chunks) {
      console.log(
        `    [DRY RUN] Chunk preview: ${c.chunkText.substring(0, 120).replace(/\n/g, " ")}...`
      );
    }
    return { inserted: chunks.length };
  }
  const batches = [];
  let cur = [];
  for (const nc of chunks) {
    cur.push(nc);
    if (cur.length >= EMBEDDING_BATCH_SIZE) {
      batches.push(cur);
      cur = [];
    }
  }
  if (cur.length) batches.push(cur);
  let inserted = 0;
  for (const b of batches) {
    const texts = b.map((x) => x.chunkText);
    const embeddings = await generateEmbeddings(texts);
    const payload = b.map((x, i) => ({
      source_id: sourceId,
      text: x.chunkText,
      text_hash: x.textHash,
      embedding: JSON.stringify(embeddings[i]),
      type: "fact",
      status: "confirmed",
      source_type: "wiki_page",
      domain: "wiki",
      layer: "hot",
      metadata: x.metadata,
    }));
    try {
      const { data: insertedRows, error } = await supabase
        .from("knowledge_chunks")
        .insert(payload)
        .select("id");
      if (error) {
        // Handle duplicate chunk errors gracefully
        const msg = (error && (error.message || error.details || error)) || String(error);
        if (
          String(msg).toLowerCase().includes("duplicate") ||
          String(msg).toLowerCase().includes("unique") ||
          (error && error.code === "23505")
        ) {
          console.warn("Duplicate chunk detected; ignoring: ", msg);
        } else {
          throw error;
        }
      }
      if (!error) inserted += (insertedRows || []).length;
    } catch (e) {
      const msg = (e && (e.message || e.details || e)) || String(e);
      if (
        String(msg).toLowerCase().includes("duplicate") ||
        String(msg).toLowerCase().includes("unique") ||
        (e && e.code === "23505")
      ) {
        console.warn(
          "Batch insert failed with unique constraint error; trying items individually for source",
          sourceId
        );
        for (const item of payload) {
          try {
            const { data: itemIns, error: itemErr } = await supabase
              .from("knowledge_chunks")
              .insert([item])
              .select("id");
            if (itemErr) {
              // ignore duplicates, else throw
              const itMsg =
                (itemErr && (itemErr.message || itemErr.details || itemErr)) || String(itemErr);
              if (
                String(itMsg).toLowerCase().includes("duplicate") ||
                String(itMsg).toLowerCase().includes("unique") ||
                (itemErr && itemErr.code === "23505")
              ) {
                continue;
              }
              throw itemErr;
            }
            inserted += (itemIns || []).length;
          } catch (inner) {
            console.error("Error inserting chunk for source", sourceId, inner.message || inner);
            throw inner;
          }
        }
      } else {
        console.error("Error inserting chunk batch for source", sourceId);
        throw e;
      }
    }
  }
  return { inserted };
}
function extractTitle(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}
async function listFiles(dir, recursive = false) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".markdown"))) files.push(full);
    if (recursive && e.isDirectory()) files.push(...(await listFiles(full, recursive)));
  }
  return files;
}
function buildChunkText(title, chunkContent, part) {
  let txt = `TYPE: fact\nSTATUT: confirmed\nSOURCE: Wiki\n`;
  if (title) txt += `DOCUMENT: ${title} (Partie ${part.part}/${part.total})\n\n`;
  txt += `${title ? title + "\n\n" : ""}${chunkContent}`;
  return txt;
}
async function processPage(filePath, slug) {
  const content = await fs.readFile(filePath, "utf8");
  const title = extractTitle(content) || slug.replace(/[-_.]/g, " ");
  // For file-based ingestion, we do not have page_id/author metadata
  const source = await upsertSource(slug, filePath, content, title, {}, false);
  if (!source.changed) return { processed: false, inserted: 0 };
  if (FORCE && !DRY_RUN) {
    const { error: deleteErr } = await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("source_id", source.id);
    if (deleteErr) {
      console.error(
        "Error deleting existing chunks for source",
        source.id,
        deleteErr.message || deleteErr
      );
      throw deleteErr;
    }
  }
  const chunks = chunkMarkdown(content);
  const queue = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = buildChunkText(title, chunks[i], { part: i + 1, total: chunks.length });
    const textHash = hashText(chunkText);
    if (await chunkExists(textHash, "wiki_page")) continue;
    queue.push({ chunkText, textHash, metadata: { page_slug: slug, title } });
  }
  const { inserted } = await insertChunks(source.id, queue);
  return { processed: true, inserted };
}

// DB-based processing
async function fetchPagesFromDb({ slug = null, since = null, limit = null } = {}) {
  // Include author id, created_at, updated_at, metadata
  let q = supabase
    .from("wiki_pages")
    .select("id,slug,title,content,author_id,created_at,updated_at,metadata");
  if (slug) q = q.eq("slug", slug);
  if (since) q = q.gte("updated_at", since);
  if (limit) q = q.limit(limit);
  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) throw error;
  const pages = data || [];
  // Fetch display names for all authors in a single query
  const authorIds = [...new Set(pages.filter((p) => p.author_id).map((p) => p.author_id))];
  if (authorIds.length === 0) return pages;
  async function getAuthorDisplayMap(ids) {
    try {
      const { data, error } = await supabase
        .from("public.users")
        .select("id,display_name,email")
        .in("id", ids);
      if (error || !data) return {};
      const m = {};
      for (const u of data) m[u.id] = u.display_name || u.email?.split("@")[0] || u.id;
      return m;
    } catch (_) {
      // silently ignore; not critical for ingestion
      return {};
    }
  }
  const userMap = await getAuthorDisplayMap(authorIds);
  return pages.map((p) => ({ ...p, author_display_name: userMap[p.author_id] || null }));
}

async function processDbPage(page) {
  const slug = page.slug;
  const title = page.title || extractTitle(page.content) || slug.replace(/[-_.]/g, " ");
  const content = page.content;
  const publicPath = `supabase://wiki_pages/${slug}`;
  const extraMeta = {
    page_id: page.id,
    // Use author_display_name where available; keep author_id for traceability
    author_display_name: page.author_display_name || null,
    author_id: page.author_id || null,
    created_at: page.created_at,
    updated_at: page.updated_at,
    page_metadata: page.metadata || null,
  };
  // Ensure global_id and origin_hub_id exist in page_metadata
  try {
    const subdomain = process.env.VITE_COMMUNITY_NAME || process.env.VITE_COMMUNITY_SLUG || "local";
    const hubType = process.env.VITE_HUB_TYPE || "commune";
    const isGlobalRoot = hubType === "national" || process.env.VITE_IS_HUB === "true";
    const globalId = isGlobalRoot ? `global:${page.slug}` : `instance:${subdomain}:${page.slug}`;
    if (!extraMeta.page_metadata) extraMeta.page_metadata = {};
    extraMeta.page_metadata.wiki_page = extraMeta.page_metadata.wiki_page || {};
    if (!extraMeta.page_metadata.wiki_page.global_id)
      extraMeta.page_metadata.wiki_page.global_id = globalId;
    if (!extraMeta.page_metadata.wiki_page.origin_hub_id)
      extraMeta.page_metadata.wiki_page.origin_hub_id = subdomain;
  } catch (e) {
    // ignore
  }
  const source = await upsertSource(slug, publicPath, content, title, extraMeta, true);
  if (!source.changed) return { processed: false, inserted: 0 };
  if (FORCE && !DRY_RUN) {
    const { error: deleteErr } = await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("source_id", source.id);
    if (deleteErr) {
      console.error(
        "Error deleting existing chunks for source",
        source.id,
        deleteErr.message || deleteErr
      );
      throw deleteErr;
    }
  }
  const chunks = chunkMarkdown(content);
  const queue = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = buildChunkText(title, chunks[i], { part: i + 1, total: chunks.length });
    const textHash = hashText(chunkText);
    if (await chunkExists(textHash, "wiki_page")) continue;
    queue.push({
      chunkText,
      textHash,
      metadata: {
        page_slug: slug,
        title,
        page_id: page.id,
        author_display_name: page.author_display_name || null,
        author_id: page.author_id,
        created_at: page.created_at,
        updated_at: page.updated_at,
      },
    });
  }
  const { inserted } = await insertChunks(source.id, queue);
  return { processed: true, inserted };
}
async function main() {
  const slugIdx = argv.indexOf("--slug");
  const slug = slugIdx !== -1 ? argv[slugIdx + 1] : null;
  const sinceIdx = argv.indexOf("--since");
  const since = sinceIdx !== -1 ? argv[sinceIdx + 1] : null;
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx !== -1 ? Number(argv[limitIdx + 1]) : null;

  console.log("Ingestion mode: Supabase wiki -> knowledge_chunks");
  const pages = slug
    ? await fetchPagesFromDb({ slug, since, limit })
    : await fetchPagesFromDb({ since, limit });
  if (argv.includes("--inspect-db")) {
    console.log("Pages fetched from DB:", pages.length);
    for (const p of pages) {
      console.log("---");
      console.log(`id: ${p.id}`);
      console.log(`slug: ${p.slug}`);
      console.log(`title: ${p.title}`);
      console.log(`author_id: ${p.author_id}`);
      if (p.author_display_name) console.log(`author_display_name: ${p.author_display_name}`);
      console.log(`created_at: ${p.created_at}`);
      console.log(`updated_at: ${p.updated_at}`);
      console.log(`metadata: ${JSON.stringify(p.metadata || {})}`);
      const preview = String(p.content || "")
        .substring(0, 400)
        .replace(/\n/g, " ");
      console.log(
        `content (preview): ${preview}${String(p.content || "").length > 400 ? "..." : ""}`
      );
    }
    return; // done
  }
  console.log("Pages to process:", pages.length);
  let processed = 0,
    inserted = 0;
  for (let i = 0; i < pages.length; i++) {
    if (LIMIT && processed >= LIMIT) break;
    const page = pages[i];
    try {
      const res = await processDbPage(page);
      if (res.processed) processed++;
      inserted += res.inserted || 0;
    } catch (err) {
      console.error("Error processing page", page.slug, err.message || err);
    }
  }
  console.log(`Processed: ${processed}, inserted: ${inserted}`);
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
