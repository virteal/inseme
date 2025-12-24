// netlify/edge-functions/root-redirect.js

import { initializeInstanceAdmin, getConfig } from "../../common/config/instanceConfig.edge.js";

export default async (request, context) => {
  const url = new URL(request.url);

  // Debug log about the url we're serving
  console.log(`[edge-function/root-redirect.js] Serving request for ${url.pathname}`);

  // TODO: should look at subdomain or some arg to get instance config
  await initializeInstanceAdmin();

  // Redirect or not based on Netlify env vars, used for dev only
  const should_redirect = getConfig("REDIRECT_ENABLED");
  const redirect_url = getConfig("REDIRECT_URL");
  //console.log("should_redirect=", should_redirect, ", redirecturl=", redirect_url);

  if (should_redirect) {
    // Redirect only if required & appropriate, else process as usual
    try {
      const target = new URL(redirect_url);
      // bypass if same host
      if (url.host === target.host) return context.next();
      // bypass if developer sets cookie to skip (optional)
      const cookie = request.headers.get("cookie") || "";
      if (/ngrok_bypass=1/.test(cookie)) return context.next();
      // Redirect to dev server thru ngrok tunnel
      return Response.redirect(cfg.redirect_url, 302);
    } catch (e) {
      console.error("Error redirecting to", redirect_url, e);
    }
  }

  // If this is a markdown file request, redirect to /markdown-viewer
  const markdownTarget = resolveMarkdownTarget(request, url);
  if (markdownTarget) {
    const viewerUrl = new URL(request.url);
    viewerUrl.pathname = "/markdown-viewer";
    viewerUrl.search = new URLSearchParams({ file: markdownTarget }).toString();
    return Response.redirect(viewerUrl.toString(), 302);
  }

  // Process, most functions will to call loadInstanceConfig()
  return context.next();
};

function resolveMarkdownTarget(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const accept = request.headers.get("accept") || "";
  const wantsHtml = accept.startsWith("text/html") || accept.includes("text/html,");
  if (!wantsHtml) return null;

  if (!url.pathname.startsWith("/docs/")) return null;
  if (url.pathname === "/docs/") return null; // à traiter ailleurs (index)
  if (url.searchParams.get("raw") === "1") return null;
  if (!url.pathname.endsWith(".md")) return null;

  // bypass internal fetches if implemented
  if (request.headers.get("x-ophelia-internal") === "1") return null;

  return `${url.pathname}${url.search}`;
}
