// File: packages/cop-kernel/src/transport.js

/**
 * POST a COP_MESSAGE to the /cop endpoint of a given baseUrl or endpoint.
 *
 * @param {Object} params
 * @param {Object} params.message     - COP_MESSAGE object
 * @param {string} [params.endpoint]  - full URL to POST to (has priority if set)
 * @param {string} [params.baseUrl]   - base URL, /cop will be appended
 * @returns {Promise<{ok: boolean, response?: any, status: number, error?: string}>}
 */
export async function postCopMessage(params) {
  const { message, endpoint, baseUrl } = params || {};
  if (!message || typeof message !== "object") {
    throw new Error("postCopMessage: 'message' is required");
  }

  let url;
  if (endpoint) {
    url = endpoint;
  } else if (baseUrl) {
    const u = new URL("/cop", baseUrl);
    url = u.toString();
  } else {
    throw new Error("postCopMessage: 'endpoint' or 'baseUrl' is required");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: body && body.error ? body.error : `HTTP ${res.status}`,
      response: body,
    };
  }

  return {
    ok: true,
    status: res.status,
    response: body,
  };
}
