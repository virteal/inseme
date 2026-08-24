/**
 * Small runtime-neutral HTTP service multiplexer.
 *
 * Services expose Web Fetch handlers, so the same descriptor is usable from
 * Deno directly and from Node through the Node adapter.
 */
export function createServiceHost(services = []) {
  const routes = [];

  for (const service of services) {
    if (!service?.id || typeof service.handle !== "function") {
      throw new TypeError("Each HTTP service needs an id and a handle(request) function");
    }
    for (const mount of service.mounts || []) {
      const normalizedMount = normalizeMount(mount);
      if (routes.some((route) => route.mount === normalizedMount)) {
        throw new Error(`Duplicate HTTP service mount: ${normalizedMount}`);
      }
      routes.push({ id: service.id, mount: normalizedMount, handle: service.handle });
    }
  }

  routes.sort((left, right) => right.mount.length - left.mount.length);

  return {
    services: routes.map(({ id, mount }) => ({ id, mount })),
    async handle(request) {
      const pathname = new URL(request.url).pathname;
      const route = routes.find(({ mount }) => pathname === mount || pathname.startsWith(`${mount}/`));
      return route ? route.handle(request) : null;
    },
  };
}

function normalizeMount(value) {
  const mount = String(value || "").trim().replace(/\/$/, "");
  if (!mount.startsWith("/")) throw new TypeError(`Invalid HTTP service mount: ${value}`);
  return mount || "/";
}
