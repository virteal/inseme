import { Readable } from "node:stream";

/** Convert a Fetch service host into a Node http.createServer listener. */
export function createNodeHttpAdapter(serviceHost) {
  return async function nodeHttpAdapter(req, res) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
      else if (value != null) headers.set(name, value);
    }
    const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
    const method = req.method || "GET";
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`${protocol}://${host}${req.url || "/"}`, {
      method,
      headers,
      ...(body ? { body } : {}),
    });
    const response = await serviceHost.handle(request);
    if (!response) return false;

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
    return true;
  };
}
