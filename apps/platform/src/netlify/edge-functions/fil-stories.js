import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
} from "../../common/config/instanceConfig.edge.js";

export const config = { path: "/api/fil/stories" };

export default async function handler(request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "top"; // top, new
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);
  const pretty = url.searchParams.get("print") === "pretty";

  // Load instance config from supabase
  await loadInstanceConfig();
  const supabase = getSupabase();

  let query = supabase
    .from("posts")
    .select("id, metadata, created_at")
    .ilike("metadata->>type", "fil_%")
    .limit(limit);

  // Sorting
  if (type === "new") {
    query = query.order("created_at", { ascending: false });
  } else {
    // top: sort by score
    query = query.order("metadata->fil_score", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // HN-style: return array of IDs or full items
  const result = pretty
    ? data.map((item) => ({
        id: item.id,
        score: item.metadata?.fil_score || 0,
        time: Math.floor(new Date(item.created_at).getTime() / 1000),
        title: item.metadata?.title || item.metadata?.external_url || "",
        url: item.metadata?.external_url || null,
        type: (item.metadata?.type || "fil_link").replace("fil_", ""),
      }))
    : data.map((item) => item.id);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
