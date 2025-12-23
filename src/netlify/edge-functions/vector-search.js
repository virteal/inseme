import { OpenAI } from "https://deno.land/x/openai@v4.24.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export default async (request, context) => {
    // CORS
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
    }

    try {
        const { action, text, room_id, id } = await request.json();
        const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
        const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

        if (action === 'embed') {
            if (!text || !id) return new Response("Missing text or id", { status: 400 });

            // Generate Embedding
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
                encoding_format: "float",
            });
            const embedding = embeddingResponse.data[0].embedding;

            // Save to DB
            const { error } = await supabase
                .from('inseme_messages')
                .update({ embedding })
                .eq('id', id);

            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }

        if (action === 'search') {
            if (!text || !room_id) return new Response("Missing query text or room_id", { status: 400 });

            // Generate Query Embedding
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
                encoding_format: "float",
            });
            const query_embedding = embeddingResponse.data[0].embedding;

            // Call RPC
            const { data: documents, error } = await supabase.rpc('match_messages', {
                query_embedding,
                match_threshold: 0.5, // Sensitivity
                match_count: 5,
                room_id_filter: room_id
            });

            if (error) throw error;

            // Filter for high-value content only? Optional.
            // For now, return all matches (reports, propositions, etc.)

            return new Response(JSON.stringify({ documents }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }

        return new Response("Invalid action", { status: 400 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const config = { path: "/api/vector-search" };
