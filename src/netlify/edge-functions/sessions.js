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
        const { room_id, gap_threshold = 3600 } = await request.json(); // default 1 hour gap

        if (!room_id) {
            return new Response(JSON.stringify({ error: "Room ID is required" }), { status: 400 });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Algorithm:
        // 1. Fetch only timestamps of all messages for the room (very light)
        // 2. Scan timestamps to find gaps > threshold
        // 3. Group into sessions
        
        const { data: timestamps, error } = await supabase
            .from('inseme_messages')
            .select('created_at')
            .eq('room_id', room_id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const sessions = [];
        if (timestamps.length > 0) {
            let currentSession = {
                start: timestamps[0].created_at,
                end: timestamps[0].created_at,
                count: 1
            };

            for (let i = 1; i < timestamps.length; i++) {
                const prev = new Date(timestamps[i - 1].created_at).getTime();
                const curr = new Date(timestamps[i].created_at).getTime();
                const gapSeconds = (curr - prev) / 1000;

                if (gapSeconds > gap_threshold) {
                    // Close current session and start new one
                    sessions.push(currentSession);
                    currentSession = {
                        start: timestamps[i].created_at,
                        end: timestamps[i].created_at,
                        count: 1
                    };
                } else {
                    currentSession.end = timestamps[i].created_at;
                    currentSession.count++;
                }
            }
            sessions.push(currentSession);
        }

        // Add some metadata to sessions (optional: fetch first message of each session for a title)
        const sessionsWithMetadata = await Promise.all(sessions.reverse().map(async (s, index) => {
             // Get the first real message (not joined/left) to find a potential title
             const { data: firstMsg } = await supabase
                .from('inseme_messages')
                .select('message, type')
                .eq('room_id', room_id)
                .gte('created_at', s.start)
                .neq('type', 'presence_log')
                .limit(1)
                .maybeSingle();

            return {
                id: `session-${sessions.length - index}`,
                ...s,
                title: firstMsg?.message?.substring(0, 50) || "Session sans titre"
            };
        }));

        return new Response(JSON.stringify({ sessions: sessionsWithMetadata }), {
            headers: { 
                "Content-Type": "application/json", 
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, s-maxage=300" // Cache for 5 minutes
            },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }
};

export const config = { path: "/api/sessions" };
