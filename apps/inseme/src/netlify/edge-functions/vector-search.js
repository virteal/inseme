import OpenAI from "https://esm.sh/openai@4";
import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";

export default defineEdgeFunction(async (request, runtime, context) => {
    const { getConfig, json, error, newSupabase } = runtime;
    try {
        const { action, text, room_id, id } = await request.json();
        const apiKey = getConfig('OPENAI_API_KEY');
        const openai = new OpenAI({ apiKey });
        
        // Use service role if available for vector updates
        const supabase = newSupabase(true);
        if (!supabase) return error("Supabase configuration missing", 500);

        if (action === 'embed') {
            if (!text || !id) return error("Missing text or id", 400);

            // Generate Embedding
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
                encoding_format: "float",
            });
            const embedding = embeddingResponse.data[0].embedding;

            // Save to DB
            const { error: dbError } = await supabase
                .from('inseme_messages')
                .update({ embedding })
                .eq('id', id);

            if (dbError) throw dbError;

            return json({ success: true });
        }

        if (action === 'search') {
            if (!text || !room_id) return error("Missing query text or room_id", 400);

            // Generate Query Embedding
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
                encoding_format: "float",
            });
            const query_embedding = embeddingResponse.data[0].embedding;

            // Call RPC
            const { data: documents, error: dbError } = await supabase.rpc('match_messages', {
                query_embedding,
                match_threshold: 0.5,
                match_count: 5,
                room_id_filter: room_id
            });

            if (dbError) throw dbError;

            return json({ documents });
        }

        return error("Invalid action", 400);

    } catch (err) {
        return error(err.message);
    }
});

export const config = { path: "/api/vector-search" };

