/**
 * Fracta preview HTTP adapter for the Deno-native Olé Olé handlers.
 *
 * The server owns no service secrets: it uses the existing JHN Supabase
 * bootstrap and resolves Olé Olé configuration from the JHN instance vault.
 */
import presenceHandler from "../../../packages/brique-oleole/src/edge/presence-api.js";
import corsicaContextHandler from "../../../packages/brique-oleole/src/edge/corsica-context-api.js";

const hostname = Deno.env.get("OLEOLE_HOST") || "127.0.0.1";
const port = Number(Deno.env.get("OLEOLE_PORT") || "8892");

// The workstation .env may configure a local development proxy that is not
// available to Deno. Preview callers can opt out without changing that shared
// file or the Fracta runtime.
if (Deno.env.get("OLEOLE_IGNORE_PROXY") === "1") {
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) {
    try {
      Deno.env.delete(key);
    } catch {
      // A restricted production service simply cannot see proxy variables.
    }
  }
}

function publicRequest(request: Request) {
  const incoming = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") || incoming.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || incoming.host;
  const url = new URL(`${protocol}://${host}${incoming.pathname}${incoming.search}`);
  return new Request(url, request);
}

export async function handleOleoleRequest(request: Request) {
  const url = new URL(request.url);
  const publicFacingRequest = publicRequest(request);
  if (url.pathname === "/health" || url.pathname === "/api/oleole/health") {
    return Response.json({ ok: true, service: "oleole", runtime: "fracta-preview" });
  }
  if (url.pathname === "/api/corsica/context") {
    return corsicaContextHandler(publicFacingRequest);
  }
  if (url.pathname === "/api/oleole" || url.pathname.startsWith("/api/oleole/")) {
    return presenceHandler(publicFacingRequest, {});
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}

export const oleoleHttpService = {
  id: "oleole",
  mounts: ["/api/oleole", "/api/corsica/context"],
  handle: handleOleoleRequest,
};

if (import.meta.main) {
  Deno.serve({ hostname, port }, handleOleoleRequest);
}
