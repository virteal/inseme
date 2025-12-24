import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfig } from "../../common/config/instanceConfig.edge.js";
import { AgentExecutorService } from "../../common/services/AgentExecutorService.js";

import { getSystemPrompt } from "./lib/utils/system-prompt.js";

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
    const supabaseUrl = getConfig("supabase_url");
    const supabaseKey = getConfig("supabase_service_role_key");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { title, content, type, source_type, external_url } = body;

    if (!title || !content || !type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prepare metadata
    const metadata = {
      type: "fil_item",
      fil_type: type, // 'post', 'link', 'doc'
      source_type: source_type || null,
      external_url: external_url || null,
      federated: await (async () => {
        // 1. Explicit Ascent: User checked the box
        if (body.federated === true) return true;

        // 2. Delegated Ascent: User delegated 'sys:federation'
        try {
          // Find the tag ID for sys:federation
          const { data: tagData } = await supabase
            .from("tags")
            .select("id")
            .eq("name", "sys:federation")
            .single();

          if (!tagData) return false;

          // Check if user has ANY active delegation for this tag
          const { data: delegation } = await supabase
            .from("delegations")
            .select("id")
            .eq("delegator_id", user.id)
            .eq("tag_id", tagData.id)
            .limit(1)
            .maybeSingle();

          return !!delegation; // True if delegation exists
        } catch (err) {
          console.warn("Error checking delegated federation:", err);
          return false; // Fail safe to Local
        }
      })(),
      fil_score: 0,
      fil_comment_count: 0,
      moderation_history: [],
      title: title, // Store title in metadata as per plan
    };

    // Insert into posts table
    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        content: content,
        metadata: metadata,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating fil item:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
