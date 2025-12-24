// script/scrape-cortiderir.js
// Scrape cortideri.fr et upsert dans Supabase (table cortideri_items)

import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { loadConfig, getConfig, createSupabaseClient } from "./lib/config.js";

// Charger la configuration
await loadConfig();

let somethingChanged = false;

// ---------- Config ----------

// Catégories 1..85 (tu peux ajuster MAX_CATEGORY_ID si besoin)
const MAX_CATEGORY_ID = 85;
const CATEGORY_IDS = Array.from({ length: MAX_CATEGORY_ID }, (_, i) => i + 1);

// Nombre max de pages par catégorie (garde-fou)
const MAX_PAGES_PER_CATEGORY = 100;

// Cooldown en heures
const COOLDOWN_HOURS = 24;
const OUT_FILE_PATH = path.join(process.cwd(), "public", "docs", "cortideri.md");

const SUPABASE_URL = getConfig("supabase_url");
const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createSupabaseClient();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Helpers communs ----------

// content_text = texte de tous les <p> (sans <a>/<img>), sans limite de longueur.
function extractContentText(contentHtml, fallbackTitle) {
  if (!contentHtml) return fallbackTitle || null;

  const $ = cheerio.load(`<div id="root">${contentHtml}</div>`);
  const root = $("#root");

  const paragraphs = [];
  root.find("p").each((_, p) => {
    const clone = $(p).clone();
    clone.find("a,img").remove();
    const txt = clone.text().replace(/\s+/g, " ").trim();
    if (txt) paragraphs.push(txt);
  });

  if (!paragraphs.length) {
    return fallbackTitle || null;
  }

  // Tous les paragraphes concaténés – pas de limite de taille
  const teaser = paragraphs.join("\n\n");
  return teaser || fallbackTitle || null;
}

function extractImageUrls(contentHtml) {
  if (!contentHtml) return null;

  const $ = cheerio.load(`<div id="root">${contentHtml}</div>`);
  const root = $("#root");
  const urlsSet = new Set();

  // 1) Tous les <a href="..."> qui pointent vers une image
  root.find("a").each((_, a) => {
    const href = $(a).attr("href");
    if (href && /\.(jpe?g|png|gif|webp)$/i.test(href)) {
      urlsSet.add(href);
    }
  });

  // 2) Fallback : <img src="...">
  if (urlsSet.size === 0) {
    root.find("img").each((_, img) => {
      const src = $(img).attr("src");
      if (src && /\.(jpe?g|png|gif|webp)$/i.test(src)) {
        urlsSet.add(src);
      }
    });
  }

  if (urlsSet.size === 0) return null;
  return Array.from(urlsSet);
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------- HTTP helper ----------

async function fetchPage(url) {
  console.log(`GET ${url}`);
  const res = await axios.get(url, { timeout: 30000 });
  return res.data;
}

// ---------- Parsing catégorie (une page) ----------

function parseCategoryPage(html, categoryId) {
  const $ = cheerio.load(html);
  const items = [];

  $(".cort-items .inner-corti").each((_, el) => {
    const container = $(el);

    const linkEl = container.find("a.tooltip").first();
    const href = linkEl.attr("href");
    if (!href) return;

    const imgEl = linkEl.find("img").first();
    const imgSrc = imgEl.attr("src") || null;

    const listTitle = container.find("p").first().text().trim() || null;

    let postId = null;
    const match = href.match(/[?&]p=(\d+)/);
    if (match) {
      postId = Number(match[1]);
    }

    items.push({
      category_id: categoryId,
      url: href,
      post_id: postId,
      list_title: listTitle,
      image_url: imgSrc,
    });
  });

  return items;
}

// ---------- Parsing article complet (page ?p=...) ----------

function parseItemPage(html, fallbackTitle = null) {
  const $ = cheerio.load(html);

  const title =
    $("h1.entry-title").first().text().trim() ||
    $("article h1").first().text().trim() ||
    $("h1").first().text().trim() ||
    fallbackTitle ||
    null;

  const postText = $(".inner .post-text").first();
  const contentHtml = postText.html()?.trim() || "";

  const contentText = extractContentText(contentHtml, fallbackTitle);
  const imageUrls = extractImageUrls(contentHtml) || [];

  let commentCount = null;
  const commentText = $('.meta-wrapper .post-info li a[href*="#comments"]').first().text().trim();
  if (commentText) {
    const m = commentText.match(/(\d+)/);
    if (m) commentCount = Number(m[1]);
  }

  const tags = [];
  $(".meta-wrapper .post-tags a").each((_, a) => {
    const txt = $(a).text().trim();
    if (!txt) return;
    txt.split(";").forEach((part) => {
      const t = part.trim();
      if (t) tags.push(t);
    });
  });

  return {
    title,
    content_text: contentText,
    content_html: contentHtml,
    image_urls: imageUrls,
    comment_count: commentCount,
    tags,
  };
}

// ---------- Supabase helpers ----------

async function upsertToSupabase(record) {
  const { error } = await supabase
    .from("cortideri_items")
    .upsert(record, { onConflict: "post_id" });

  if (error) {
    console.error("Supabase error for post_id", record.post_id, error.message);
  } else {
    console.log("Upsert OK for post_id", record.post_id);
    somethingChanged = true;
  }
}

async function updateByPostId(postId, fields) {
  const { error } = await supabase.from("cortideri_items").update(fields).eq("post_id", postId);

  if (error) {
    console.error("Update error for post_id", postId, error.message);
  } else {
    console.log("Update OK for post_id", postId, fields);
    somethingChanged = true;
  }
}

// ---------- Scraper / post-process un item ----------

async function processItem(item, existingRow) {
  if (!item.post_id) return;

  // Si pas de ligne existante ou pas de content_html -> on doit re-scraper la page
  if (!existingRow || !existingRow.content_html) {
    const html = await fetchPage(item.url);
    const parsed = parseItemPage(html, item.list_title);

    const record = {
      post_id: item.post_id ?? null,
      category_id: item.category_id ?? null,
      url: item.url,
      list_title: item.list_title,
      image_url: item.image_url,
      title: parsed.title,
      content_text: parsed.content_text || item.list_title,
      content_html: parsed.content_html,
      comment_count: parsed.comment_count,
      tags: parsed.tags.length ? parsed.tags : null,
      image_urls: parsed.image_urls.length ? parsed.image_urls : null,
    };

    await upsertToSupabase(record);
    await sleep(1000);
    return;
  }

  // Ici : on a déjà content_html => post-traitement sans re-scraper
  const newContentText = extractContentText(
    existingRow.content_html,
    existingRow.list_title || item.list_title
  );
  const newImageUrls = extractImageUrls(existingRow.content_html);

  const updates = {};
  let changed = false;

  if (newContentText && newContentText !== existingRow.content_text) {
    updates.content_text = newContentText;
    changed = true;
  }

  const oldImgs = Array.isArray(existingRow.image_urls)
    ? existingRow.image_urls
    : existingRow.image_urls || null;
  const newImgs = Array.isArray(newImageUrls) ? newImageUrls : null;

  if (!arraysEqual(oldImgs, newImgs)) {
    updates.image_urls = newImgs;
    changed = true;
  }

  if (item.category_id && item.category_id !== existingRow.category_id) {
    updates.category_id = item.category_id;
    changed = true;
  }
  if (item.list_title && item.list_title !== existingRow.list_title) {
    updates.list_title = item.list_title;
    changed = true;
  }
  if (item.image_url && item.image_url !== existingRow.image_url) {
    updates.image_url = item.image_url;
    changed = true;
  }

  if (!changed) {
    console.log(`No change for post_id ${item.post_id}, skipping`);
    return;
  }

  await updateByPostId(item.post_id, updates);
}

// ---------- Scraper une catégorie (toutes les pages) ----------

async function scrapeCategory(categoryId) {
  let page = 1;
  let totalForCategory = 0;

  while (page <= MAX_PAGES_PER_CATEGORY) {
    const url =
      page === 1
        ? `http://cortideri.fr/?cat=${categoryId}`
        : `http://cortideri.fr/?cat=${categoryId}&paged=${page}`;

    let html;
    try {
      html = await fetchPage(url);
    } catch (e) {
      console.error(`Error fetching category ${categoryId}, page ${page}:`, e.message);
      break;
    }

    const items = parseCategoryPage(html, categoryId);
    console.log(`Category ${categoryId}, page ${page}: found ${items.length} items`);

    if (!items.length) {
      // Plus rien sur cette catégorie, on sort
      break;
    }

    // Récupérer les lignes existantes pour ces post_id
    const postIds = items.map((i) => i.post_id).filter((id) => !!id);
    let existingRows = [];
    if (postIds.length) {
      const { data, error } = await supabase
        .from("cortideri_items")
        .select(
          "id, post_id, category_id, url, list_title, title, content_text, image_url, content_html, comment_count, tags, image_urls"
        )
        .in("post_id", postIds);

      if (error) {
        console.error(
          "Supabase select error for category",
          categoryId,
          "page",
          page,
          error.message
        );
      } else {
        existingRows = data || [];
      }
    }

    const existingByPostId = new Map(existingRows.map((row) => [row.post_id, row]));

    for (const item of items) {
      try {
        const existing = existingByPostId.get(item.post_id) || null;
        await processItem(item, existing);
      } catch (e) {
        console.error("Error processing item", item.url, e);
      }
    }

    totalForCategory += items.length;
    page += 1;
  }

  return totalForCategory;
}

// ---------- Markdown Generator ----------

async function generateMarkdown() {
  const fileExists = fs.existsSync(OUT_FILE_PATH);

  if (!somethingChanged && fileExists) {
    console.log("No changes detected and cortideri.md exists. Skipping generation.");
    return;
  }

  console.log("Generating cortideri.md...");

  // 1. Fetch all items
  const { data: items, error } = await supabase
    .from("cortideri_items")
    .select("*")
    .order("category_id", { ascending: true })
    .order("post_id", { ascending: false });

  if (error) {
    console.error("Error fetching items for markdown generation:", error.message);
    return;
  }

  if (!items || items.length === 0) {
    console.log("No items found to generate markdown.");
    return;
  }

  // 2. Prepare content
  const lines = [];
  lines.push(`# Cortideri Archive`);
  lines.push(`Generated on: ${new Date().toLocaleString()}`);
  lines.push("");

  // Table of Contents
  lines.push("## Table of Contents");
  const categories = {};
  for (const item of items) {
    const catId = item.category_id || "Uncategorized";
    if (!categories[catId]) {
      categories[catId] = [];
    }
    categories[catId].push(item);
  }

  for (const catId of Object.keys(categories)) {
    lines.push(`- [Category ${catId}](#category-${catId})`);
    for (const item of categories[catId]) {
      const safeTitle = (item.title || "Untitled").replace(/[\[\]]/g, "");
      lines.push(`  - [${safeTitle}](#item-${item.post_id})`);
    }
  }
  lines.push("");

  // Content
  for (const catId of Object.keys(categories)) {
    lines.push(`## Category ${catId} <a id="category-${catId}"></a>`);
    lines.push("");

    for (const item of categories[catId]) {
      lines.push(`### ${item.title || "Untitled"} <a id="item-${item.post_id}"></a>`);
      lines.push(`**Post ID:** ${item.post_id}`);
      if (item.url) {
        lines.push(`**Original URL:** [${item.url}](${item.url})`);
      }
      lines.push("");

      if (item.tags && item.tags.length > 0) {
        lines.push(`**Tags:** ${item.tags.join(", ")}`);
        lines.push("");
      }

      // Content Body
      // We use teaser if content_html is complex, or we could try to use a simple html-to-markdown if needed.
      // For now, let's dump the teaser and maybe the raw text if available.
      // The user asked for "l'item avec son texte".
      // Since we have content_html, let's try to strip tags or just put the teaser which is the text content.
      // The extractTeaser function gets all paragraphs. Let's use that logic or just the teaser field if it's good enough.
      // The content_text field in DB is populated by extractContentText which joins paragraphs.

      if (item.content_text) {
        lines.push(item.content_text);
        lines.push("");
      }

      // Images
      if (item.image_urls && item.image_urls.length > 0) {
        lines.push("**Images:**");
        for (const imgUrl of item.image_urls) {
          lines.push(`![Image](${imgUrl})`);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }
  }

  // Ensure directory exists
  const dir = path.dirname(OUT_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUT_FILE_PATH, lines.join("\n"), "utf8");
  console.log(`Generated ${OUT_FILE_PATH}`);
}

// ---------- Main ----------

async function main() {
  // Check for cooldown
  if (fs.existsSync(OUT_FILE_PATH)) {
    const stats = fs.statSync(OUT_FILE_PATH);
    const hoursSinceLastRun = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    const force = process.argv.includes("--force");

    if (hoursSinceLastRun < COOLDOWN_HOURS && !force) {
      console.warn(
        `⚠️  Last scrape was ${hoursSinceLastRun.toFixed(
          1
        )} hours ago. Skipping to avoid unnecessary load.`
      );
      console.warn("   Use --force to run anyway.");
      return;
    }
  }

  let total = 0;

  for (const cid of CATEGORY_IDS) {
    try {
      const count = await scrapeCategory(cid);
      if (count > 0) {
        console.log(`Category ${cid}: total items processed = ${count}`);
      } else {
        console.log(`Category ${cid}: no items (or unreachable)`);
      }
      total += count;
    } catch (e) {
      console.error("Error scraping category", cid, e);
    }
  }

  console.log("Done. Total items seen:", total);

  await generateMarkdown();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
