import { loadInstanceConfig, newSupabase } from "@inseme/cop-host/backend";

export default async (req, context) => {
  await loadInstanceConfig();

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }

  try {
    const { slug, title, content, summary, room_id } = await req.json();

    if (!slug || !title || !content) {
      return new Response(
        JSON.stringify({ error: "slug, title and content are required" }),
        { status: 400 }
      );
    }

    const supabase = await newSupabase();

    // On génère les tokens FTS côté JS (en appelant une fonction utilitaire SQL simple ou en préparant la chaîne)
    // Ici, on demande à Postgres de calculer le vecteur pour nous lors de l'insertion,
    // mais sans trigger caché, ce qui rend l'opération explicite dans le code JS.
    const ftsCalculation = `
      setweight(to_tsvector('french', ${JSON.stringify(title)}), 'A') ||
      setweight(to_tsvector('french', ${JSON.stringify(summary || "")}), 'B') ||
      setweight(to_tsvector('french', ${JSON.stringify(content)}), 'C')
    `;

    const { data, error } = await supabase.rpc("execute_sql", {
      sql_query: `
        INSERT INTO wiki_pages (slug, title, content, summary, metadata, fts_tokens)
        VALUES (
          ${JSON.stringify(slug)}, 
          ${JSON.stringify(title)}, 
          ${JSON.stringify(content)}, 
          ${JSON.stringify(summary)}, 
          ${JSON.stringify({
            is_proposed: true,
            ai_generated: true,
            updated_at: new Date().toISOString(),
          })},
          ${ftsCalculation}
        )
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          summary = EXCLUDED.summary,
          metadata = EXCLUDED.metadata,
          fts_tokens = EXCLUDED.fts_tokens
        RETURNING *;
      `,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, page: data?.[0] }), {
      status: 200,
    });
  } catch (err) {
    console.error("wiki-propose-ai error", err.message || err);
    return new Response(JSON.stringify({ error: err.message || "internal" }), {
      status: 500,
    });
  }
};
