import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
} from "../../common/config/instanceConfig.edge.js";
export const config = { path: "/api/fil/item/*" };

export default async function handler(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const itemId = pathParts[pathParts.length - 1];

  if (!itemId) {
    return new Response(JSON.stringify({ error: "Missing item ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Load instance config from supabase
  await loadInstanceConfig();
  const supabase = getSupabase();

  // Fetch post with author
  const { data: post, error } = await supabase
    .from("posts")
    .select("*, users:author_id(id, display_name)")
    .eq("id", itemId)
    .single();

  if (error || !post) {
    return new Response(JSON.stringify({ error: "Item not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch comments (children)
  const { data: comments } = await supabase
    .from("comments")
    .select("id")
    .eq("post_id", itemId)
    .order("created_at", { ascending: true });

  const metadata = post.metadata || {};

  // HN-compatible format
  const result = {
    id: post.id,
    by: post.users?.display_name || "anon",
    time: Math.floor(new Date(post.created_at).getTime() / 1000),
    title: metadata.title || metadata.external_url || "",
    url: metadata.external_url || null,
    text: post.content || null,
    score: metadata.fil_score || 0,
    descendants: metadata.fil_comment_count || 0,
    kids: comments?.map((c) => c.id) || [],
    type: (metadata.type || "fil_link").replace("fil_", "story"),
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
