// src/netlify/functions/admin-update.js
import {
  loadInstanceConfig,
  getSupabase,
  getConfig,
} from "../../common/config/instanceConfig.edge.js";

// This function expects the following env vars set in Netlify:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY (*** KEEP SECRET ***)

export default async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Load instance config from supabase
  await loadInstanceConfig();

  const supabase = getSupabase();

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: "Invalid JSON" };
  }
  const { type, id, patch, requestorId: bodyRequestorId } = body;
  // Log incoming admin update request for debugging (avoid logging service keys)
  try {
    console.log("admin-update request", { type, id });
  } catch (e) {
    // ignore logging errors
  }
  if (!type || !id || !patch) {
    return { statusCode: 400, body: "Missing type/id/patch" };
  }

  // reuse the privileged `supabase` client created above

  const tableMap = {
    users: "users",
    posts: "posts",
    groups: "groups",
    comments: "comments",
    wiki: "wiki_pages",
    subscriptions: "content_subscriptions",
  };
  const table = tableMap[type] || type;

  try {
    const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
    if (error) {
      try {
        console.error("admin-update failed response", { type, id, error });
      } catch (e) {}
      return { statusCode: 500, body: JSON.stringify({ message: error.message, details: error }) };
    }
    try {
      console.log("admin-update success", { type, id, result: data && data.id ? "ok" : data });
    } catch (e) {}
    return { statusCode: 200, body: JSON.stringify({ data }) };
  } catch (err) {
    try {
      console.error("admin-update exception", { type, id, err: String(err) });
    } catch (e) {}
    return { statusCode: 500, body: String(err) };
  }
};
