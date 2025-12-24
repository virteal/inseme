import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { marked } from "marked";
import DOMPurify from "dompurify";

// PublicBrowser: parcourt public/docs via Netlify Function /api/public_browser
export default function PublicBrowser() {
  const baseRoot = "/public/docs";
  const location = useLocation();
  const navigate = useNavigate();
  const [path, setPath] = useState("/");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [content, setContent] = useState("");
  const [backendMessage, setBackendMessage] = useState(null);

  const fullPath = useMemo(() => {
    const p = path.replace(/^\/*/, "").replace(/\/*$/, "");
    return p ? `${baseRoot}/${p}` : baseRoot;
  }, [path]);

  useEffect(() => {
    const suffix = location.pathname.replace(/^\/browser/, "") || "/";
    if (suffix !== path) {
      setPath(suffix);
    }
  }, [location.pathname]);

  useEffect(() => {
    const target = path === "/" ? "/browser" : `/browser${path}`;
    if (location.pathname !== target) {
      navigate(target);
    }
  }, [path, location.pathname, navigate]);

  useEffect(() => {
    async function listDir() {
      setLoading(true);
      setItems(null);
      setViewFile(null);
      setContent("");
      setBackendMessage(null);
      try {
        let rel = fullPath.replace(/^\//, "");
        if (rel.startsWith("public/")) rel = rel.slice("public/".length);
        const apiPath = encodeURIComponent(rel);
        const r = await fetch(`/api/public_browser?path=${apiPath}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setItems([]);
          setBackendMessage(j?.message || `Erreur ${r.status}`);
          return;
        }
        const json = await r.json();
        // Accept { items, message, diagnostics } or legacy array
        if (Array.isArray(json)) setItems(json);
        else setItems(json.items ?? []);
        setBackendMessage(json.message ?? null);
      } catch (err) {
        console.warn("Listing failed:", err);
        setItems([]);
        setBackendMessage("Impossible de contacter le service d'archives.");
      } finally {
        setLoading(false);
      }
    }
    listDir();
  }, [fullPath]);

  function goUp() {
    if (path === "/" || path === "") return;
    const parts = path.replace(/^\//, "").split("/");
    parts.pop();
    const np = parts.length ? `/${parts.join("/")}` : "/";
    setPath(np);
  }

  async function openEntry(entry) {
    if (entry.isDir || (entry.href && entry.href.endsWith("/"))) {
      const name = entry.name.replace(/\/$/, "");
      setPath((prev) => (prev === "/" ? `/${name}` : `${prev}/${name}`));
      return;
    }
    setLoading(true);
    setViewFile(entry);
    setContent("");
    try {
      let filePath = `${fullPath.replace(/^\//, "")}/${entry.name}`;
      if (filePath.startsWith("public/")) filePath = filePath.slice("public/".length);
      const apiPath = encodeURIComponent(filePath);
      const r = await fetch(`/api/public_browser?path=${apiPath}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.file) {
        if (!j.base64) setContent(j.body || "");
        else {
          if (/^text\/|json|csv|markdown/.test(j.mime)) {
            const txt = atob(j.body);
            setContent(txt);
          } else {
            setContent(`Fichier binaire (${j.mime}). Utilisez le lien "Télécharger".`);
          }
        }
      } else {
        setContent("Contenu indisponible");
      }
    } catch (e) {
      setContent(`Erreur de lecture: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function fileDownloadUrl(entry) {
    let filePath = `${fullPath.replace(/^\//, "")}/${entry.name}`;
    if (filePath.startsWith("public/")) filePath = filePath.slice("public/".length);
    return `/api/public_browser?path=${encodeURIComponent(filePath)}&download=1`;
  }

  function renderFileContent(name, txt) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "md" || ext === "markdown") {
      const rawHtml = marked.parse(txt || "");
      try {
        const doc = new DOMParser().parseFromString(rawHtml, "text/html");
        doc.querySelectorAll("a").forEach((a) => {
          if (!a.getAttribute("target")) a.setAttribute("target", "_blank");
          if (!a.getAttribute("rel")) a.setAttribute("rel", "noopener noreferrer");
        });
        const sanitized = DOMPurify.sanitize(doc.body.innerHTML);
        // Use site-wide markdown styling
        return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
      } catch {
        const sanitized = DOMPurify.sanitize(rawHtml);
        return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
      }
    }
    if (ext === "json") {
      try {
        return <pre>{JSON.stringify(JSON.parse(txt || "{}"), null, 2)}</pre>;
      } catch {
        return <pre>{txt}</pre>;
      }
    }
    if (ext === "csv") {
      const lines = (txt || "").trim().split(/\r?\n/).filter(Boolean);
      const rows = lines.map((l) => l.split(","));
      return (
        <div className="browser-csv">
          <table>
            <thead>
              <tr>
                {(rows[0] || []).map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <pre className="whitespace-pre-wrap">{txt}</pre>;
  }

  return (
    <div className="public-browser">
      <div className="browser-header flex justify-between items-center gap-3">
        <h2>Explorateur public (public/docs)</h2>
        <div>
          <button
            onClick={() => {
              setPath("/");
            }}
            className="px-3 py-1 border border-gray-300  text-gray-200 hover:bg-gray-50 mr-2"
            aria-label="Aller à la racine"
          >
            Racine
          </button>
          <button
            onClick={goUp}
            className="px-3 py-1 border border-gray-300  text-gray-200 hover:bg-gray-50"
            aria-label="Remonter d'un niveau"
          >
            Remonter
          </button>
        </div>
      </div>

      <div className="browser-body flex gap-5">
        <div className="browser-list w-[480px] min-w-[360px] max-w-[560px] border-r border-gray-200 pr-3 box-border">
          <p>
            <strong>Chemin :</strong> {path}
          </p>
          {backendMessage && (
            <div className="mb-2 p-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-100 ">
              {backendMessage}
            </div>
          )}
          {loading && <p>Chargement...</p>}
          {!loading && items && items.length === 0 && !backendMessage && (
            <p>Pas de listing disponible pour {fullPath}.</p>
          )}
          {!loading && items && items.length > 0 && (
            <ul className="list-none p-0">
              {items.map((it, i) => {
                const displayName = it.name || it.href;
                return (
                  <li key={i} className="mb-2 flex items-center justify-between">
                    <button
                      onClick={() => openEntry(it)}
                      className="flex items-center gap-2   px-3 py-2 hover:bg-slate-100 w-full text-left"
                    >
                      <span className="mr-2">{it.isDir ? "📁" : "📄"}</span>
                      <span className="inline-block break-words overflow-anywhere whitespace-normal leading-tight max-w-full">
                        {displayName}
                      </span>
                    </button>
                    {!it.isDir && (
                      <a
                        href={fileDownloadUrl(it)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-3 inline-flex items-center gap-2 px-2 py-1 border border-gray-200  text-sm text-gray-200 hover:bg-gray-50"
                        title="Télécharger le fichier"
                      >
                        ⬇
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="browser-view flex-1">
          {viewFile ? (
            <>
              <div className="flex justify-between items-center">
                <h3 className="break-words">{viewFile.name}</h3>
                <div>
                  <a
                    href={fileDownloadUrl(viewFile)}
                    download
                    className="px-3 py-1 bg-accent-blue text-bauhaus-white no-underline"
                  >
                    Télécharger
                  </a>
                </div>
              </div>
              {loading ? (
                <p>Chargement du fichier...</p>
              ) : (
                renderFileContent(viewFile.name, content)
              )}
            </>
          ) : (
            <p>Sélectionnez un fichier à prévisualiser.</p>
          )}
        </div>
      </div>
    </div>
  );
}
