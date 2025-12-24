import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";

/*
  Netlify Function (ESM) - public browser
  Query params:
    - path=docs/officiel or path=docs/officiel/file.pdf
    - download=1 to force raw download (binary served base64 if needed)
*/
const ROOT = path.join(process.cwd(), "public");

const MIME = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function jsonResponse(status, body) {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  const q = event.queryStringParameters || {};
  const relRaw = String(q.path || "").replace(/^\/+/, ""); // e.g. "docs/officiel"
  const download = q.download === "1" || q.download === "true";

  // resolve and protect against path traversal
  const target = path.normalize(path.join(ROOT, relRaw || ""));
  const resolvedRoot = path.resolve(ROOT);
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    console.warn(`[public_browser] path traversal attempt: ${relRaw}`);
    return jsonResponse(400, { error: "Invalid path", message: "Chemin invalide" });
  }

  // Diagnostics quick probe
  let diag = { cwd: process.cwd(), public_resolved: resolvedRoot, requested: relRaw };
  try {
    const bobCandidate = path.join(resolvedRoot, "docs", "bob_prompt.md");
    try {
      const s = fsSync.statSync(bobCandidate);
      diag.bob_prompt = {
        exists: true,
        size: s.size,
        mtime: s.mtime.toISOString(),
        path: bobCandidate,
      };
    } catch (e) {
      diag.bob_prompt = {
        exists: false,
        reason: e.code || String(e.message || e),
        path: bobCandidate,
      };
    }
  } catch (e) {
    diag.bob_probe_error = String(e.message || e);
  }

  try {
    const stat = await fs.stat(resolvedTarget);
    if (stat.isDirectory()) {
      const names = await fs.readdir(resolvedTarget, { withFileTypes: true });
      const items = names
        .map((d) => {
          const isDir = d.isDirectory();
          const href = path.posix.join("/", relRaw || "", d.name) + (isDir ? "/" : "");
          return {
            name: d.name,
            href,
            isDir,
            size: isDir ? 0 : fsSync.statSync(path.join(resolvedTarget, d.name)).size || 0,
          };
        })
        .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));

      if (items.length === 0) {
        console.info(`[public_browser] empty directory: ${relRaw}`);
        return jsonResponse(200, {
          items: [],
          message: `Aucun document trouvé dans /${relRaw}. L'archive peut être en cours de génération.`,
          diagnostics: diag,
        });
      }

      return jsonResponse(200, { items, diagnostics: diag });
    }

    if (stat.isFile()) {
      const ext = path.extname(resolvedTarget).toLowerCase();
      const mime = MIME[ext] || "application/octet-stream";
      const buf = await fs.readFile(resolvedTarget);
      const isBinary =
        !/^text\/|\/json|\/csv|\/markdown|^image\//.test(mime) &&
        mime !== "text/plain; charset=utf-8";

      if (download) {
        const body = isBinary ? buf.toString("base64") : buf.toString("utf8");
        const headers = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="${path.basename(resolvedTarget)}"`,
        };
        return {
          statusCode: 200,
          headers,
          body,
          isBase64Encoded: isBinary,
        };
      }

      // Default: return JSON wrapper describing file and content (text or base64)
      const body = isBinary ? buf.toString("base64") : buf.toString("utf8");
      return jsonResponse(200, {
        file: true,
        name: path.basename(resolvedTarget),
        mime,
        base64: isBinary,
        body,
        diagnostics: diag,
      });
    }

    return jsonResponse(404, { error: "Not found", message: `Chemin introuvable: /${relRaw}` });
  } catch (e) {
    if (e.code === "ENOENT") {
      console.info(`[public_browser] not found: ${relRaw}`);
      return jsonResponse(404, {
        error: "Not found",
        message: `Aucun document trouvé pour /${relRaw} (404). Vérifiez que les archives ont été générées.`,
        diagnostics: diag,
      });
    }
    console.error("[public_browser] unexpected error:", e);
    return jsonResponse(500, {
      error: String(e.message || e),
      message: "Erreur serveur. Le problème est identifié.",
      diagnostics: diag,
    });
  }
}
