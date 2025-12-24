import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
} from "../../common/config/instanceConfig.edge.js";
export const config = { path: "/api/rag/ingest" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth check
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7);
  const supabaseUrl = getConfig("SUPABASE_URL");
  const supabaseAnonKey = getConfig("SUPABASE_ANON_KEY");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Verify user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { fil_id, url, title, text } = body;

    if (!fil_id) {
      return new Response(JSON.stringify({ error: "fil_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if already ingested
    const { data: existing } = await supabase
      .from("document_sources")
      .select("id")
      .eq("external_id", fil_id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ status: "already_ingested", id: existing.id }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Insert into document_sources
    const { data: newSource, error: insertError } = await supabase
      .from("document_sources")
      .insert({
        external_id: fil_id,
        source_type: "fil_item",
        url: url || null,
        filename: title || `fil-${fil_id}`,
        status: "active",
        metadata: { title, fil_id, ingested_by: user.id, ingested_at: new Date().toISOString() },
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(JSON.stringify({ status: "ingested", id: newSource.id }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("RAG ingest error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
