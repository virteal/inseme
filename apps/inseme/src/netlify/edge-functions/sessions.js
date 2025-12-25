import { defineEdgeFunction } from "../../../../../packages/cop-host/src/runtime/edge.js";

export default defineEdgeFunction(async (request, runtime, context) => {
    const { getConfig, json, error, getSupabase } = runtime;
    try {
        const { room_id, gap_threshold = 3600 } = await request.json(); // default 1 hour gap

        if (!room_id) {
            return error("Room ID is required", 400);
        }

        const supabase = getSupabase();

        // Algorithm:
        // 1. Fetch only timestamps of all messages for the room (very light)
        // 2. Scan timestamps to find gaps > threshold
        // 3. Group into sessions
        
        const { data: timestamps, error: dbError } = await supabase
            .from('inseme_messages')
            .select('created_at')
            .eq('room_id', room_id)
            .order('created_at', { ascending: true });

        if (dbError) throw dbError;

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

        return json({ sessions: sessionsWithMetadata }, 200, {
            "Cache-Control": "public, s-maxage=300" // Cache for 5 minutes
        });

    } catch (err) {
        return error(err.message);
    }
});

export const config = { path: "/api/sessions" };

