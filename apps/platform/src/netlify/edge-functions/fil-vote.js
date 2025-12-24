// src/netlify/edge-functions/fil-vote.js
import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
} from "../../common/config/instanceConfig.edge.js";

export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Load instance config from supabase
    await loadInstanceConfig();
    const supabase = getSupabase();

    // Get the user from the request authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { postId, voteValue } = body; // voteValue: 1, -1, or 0 (remove vote)

    if (!postId || voteValue === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Handle Reaction
    if (voteValue === 0) {
      // Remove vote
      await supabase
        .from("reactions")
        .delete()
        .eq("user_id", user.id)
        .eq("target_id", postId)
        .in("emoji", ["+1", "-1"]);
    } else {
      const emoji = voteValue === 1 ? "+1" : "-1";
      // Upsert vote (delete existing opposite vote first if needed, or just upsert if we enforce unique constraint logic manually)
      // Simpler: Delete any existing +1/-1 for this user/post, then insert new one
      await supabase
        .from("reactions")
        .delete()
        .eq("user_id", user.id)
        .eq("target_id", postId)
        .in("emoji", ["+1", "-1"]);

      await supabase.from("reactions").insert({
        user_id: user.id,
        target_id: postId,
        target_type: "post",
        emoji: emoji,
      });
    }

    // 2. Recalculate Score
    // Count +1
    const { count: upvotes } = await supabase
      .from("reactions")
      .select("*", { count: "exact", head: true })
      .eq("target_id", postId)
      .eq("emoji", "+1");

    // Count -1
    const { count: downvotes } = await supabase
      .from("reactions")
      .select("*", { count: "exact", head: true })
      .eq("target_id", postId)
      .eq("emoji", "-1");

    // Count comments
    const { count: commentCount } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    const score = (upvotes || 0) - (downvotes || 0) + (commentCount || 0) * 0.5;

    // 3. Update Post Metadata
    // First fetch current metadata to preserve other fields
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("metadata")
      .eq("id", postId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const newMetadata = {
      ...post.metadata,
      fil_score: score,
      fil_comment_count: commentCount || 0,
    };

    const { error: updateError } = await supabase
      .from("posts")
      .update({ metadata: newMetadata })
      .eq("id", postId);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ score, upvotes, downvotes, commentCount }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Unexpected error in fil-vote:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
