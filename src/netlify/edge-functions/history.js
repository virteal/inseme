import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export default async (request, context) => {
    // Handle CORS
    if (request.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    try {
        const { query, filters = {} } = await request.json();
        const { room_id, user, date_from, date_to, type, limit = 20 } = filters;

        if (!room_id) {
            return new Response(JSON.stringify({ error: "Room ID is required" }), { status: 400 });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
        const supabase = createClient(supabaseUrl, supabaseKey);

        let dbQuery = supabase
            .from('inseme_messages')
            .select('*')
            .eq('room_id', room_id)
            .order('created_at', { ascending: false })
            .limit(limit);

        // Apply filters
        if (query && query.trim() !== "") {
            // Use plain text search or 'ilike' for simplicity if FTS not set up
            // textSearch('message', query) requires tsvector setup usually for simple 'english', 
            // but ilike is safer for generic implementation without migration.
            dbQuery = dbQuery.ilike('message', `%${query}%`);
        }

        if (user) {
            dbQuery = dbQuery.ilike('name', `%${user}%`);
        }

        if (type) {
            // Handle special 'presence_log' type query
            if (type === 'presence') {
                dbQuery = dbQuery.eq('type', 'presence_log');
            } else {
                dbQuery = dbQuery.eq('type', type);
            }
        }

        if (date_from) {
            dbQuery = dbQuery.gte('created_at', date_from);
        }

        if (date_to) {
            dbQuery = dbQuery.lte('created_at', date_to);
        }

        const { data, error } = await dbQuery;

        if (error) throw error;

        return new Response(JSON.stringify({ results: data }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }
};

export const config = { path: "/api/history" };
