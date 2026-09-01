import test from "node:test";
import assert from "node:assert/strict";
import { DynamicStorageServingAdapter } from "../../../packages/cop-host/src/edge/storageServingAdapter.js";

test("Issue #53: Dynamic Storage-backed serving adapter with caching, ETag, and static fallback", async () => {
  const mockStorageMap = new Map();
  mockStorageMap.set("pertitellu-corte/index.html", {
    content: "<html><body><h1>Pertitellu Corte - Dynamic Storage Live</h1></body></html>",
    contentType: "text/html; charset=utf-8",
    visibility: "public",
  });
  mockStorageMap.set("secret-twin/admin.html", {
    content: "<html><body><h1>Admin Vault</h1></body></html>",
    contentType: "text/html; charset=utf-8",
    visibility: "restricted",
  });

  const mockStorageClient = {
    async download(bucket, path) {
      if (bucket !== "hosted-twin-artifacts") throw new Error("Unknown bucket");
      if (mockStorageMap.has(path)) return mockStorageMap.get(path);
      throw new Error("Object not found");
    },
  };

  const staticFallbackMap = new Map();
  staticFallbackMap.set("shared/base.css", "body { font-family: sans-serif; }");

  const adapter = new DynamicStorageServingAdapter({
    bucketName: "hosted-twin-artifacts",
    edgeCacheTtlSeconds: 60,
    storageClient: mockStorageClient,
    staticFallbackMap,
  });

  // 1. First Request -> Fetches from Supabase Storage origin
  const res1 = await adapter.handleRequest({ path: "/pertitellu-corte/index.html" });
  assert.equal(res1.status, 200);
  assert.equal(res1.headers["X-Served-By"], "cop-supabase-storage-origin");
  assert.match(res1.body, /Dynamic Storage Live/);
  const etag1 = res1.headers["ETag"];
  assert.ok(etag1);

  // 2. Second Request -> Served from Edge In-Memory Cache
  const res2 = await adapter.handleRequest({ path: "/pertitellu-corte/index.html" });
  assert.equal(res2.status, 200);
  assert.equal(res2.headers["X-Served-By"], "cop-edge-storage-cache");
  assert.equal(res2.headers["ETag"], etag1);

  // 3. Conditional GET with matching If-None-Match -> 304 Not Modified
  const res3 = await adapter.handleRequest({
    path: "/pertitellu-corte/index.html",
    ifNoneMatch: etag1,
  });
  assert.equal(res3.status, 304);
  assert.equal(res3.body, null);

  // 4. Agent updates content in Storage & invalidates Edge cache
  mockStorageMap.set("pertitellu-corte/index.html", {
    content: "<html><body><h1>Pertitellu Corte - Updated by Agent JHN</h1></body></html>",
    contentType: "text/html; charset=utf-8",
    visibility: "public",
  });
  adapter.invalidateCache("pertitellu-corte/index.html");

  const res4 = await adapter.handleRequest({ path: "/pertitellu-corte/index.html" });
  assert.equal(res4.status, 200);
  assert.equal(res4.headers["X-Served-By"], "cop-supabase-storage-origin");
  assert.match(res4.body, /Updated by Agent JHN/);

  // 5. Fallback to Prebuilt Static asset when not present in Storage
  const resStatic = await adapter.handleRequest({ path: "/shared/base.css" });
  assert.equal(resStatic.status, 200);
  assert.equal(resStatic.headers["X-Served-By"], "cop-static-prebuilt-fallback");
  assert.match(resStatic.body, /sans-serif/);

  // 6. Security Check: Restricted twin artifact without auth -> 403 Forbidden
  const resForbidden = await adapter.handleRequest({ path: "/secret-twin/admin.html" });
  assert.equal(resForbidden.status, 403);

  // Restricted twin artifact with auth -> 200 OK
  const resAllowed = await adapter.handleRequest({
    path: "/secret-twin/admin.html",
    authContext: { authenticated: true },
  });
  assert.equal(resAllowed.status, 200);
  assert.match(resAllowed.body, /Admin Vault/);

  // 7. Non-existent asset -> 404 Not Found
  const res404 = await adapter.handleRequest({ path: "/non-existent/page.html" });
  assert.equal(res404.status, 404);
});
