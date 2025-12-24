// File: netlify/edge-functions/cop-stream.js
// Description:
//   SSE streaming endpoint for COP channels (Edge Function, Deno/Netlify).
//   - Query params: ?channel=<COPCHAN_ADDR>&since_id=<id_optionnel>
//   - Boucle de polling sur la table cop_events pour ce channel, id > since_id.
//   - Pousse chaque événement sous forme SSE (event: <event_type>, data: <COP_EVENT-like JSON>, id: <row.id>).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn(
    "[cop-stream] SUPABASE_URL or SUPABASE_SERVICE_ROLE not set; this function will fail at runtime."
  );
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;

// Intervalle de polling de base (en ms)
const POLL_INTERVAL_MS = 1000;

export default async (request, context) => {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!supabase) {
    return new Response("Supabase not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const channel = url.searchParams.get("channel");
  const sinceIdParam = url.searchParams.get("since_id");
  let lastId = sinceIdParam ? Number(sinceIdParam) : 0;

  if (!channel) {
    return new Response("Missing 'channel' query parameter", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Event initial "hello"
      controller.enqueue(
        encoder.encode(`event: hello\ndata: ${JSON.stringify({ channel, since_id: lastId })}\n\n`)
      );

      try {
        while (true) {
          const { data, error } = await supabase
            .from("cop_events")
            .select("*")
            .gt("id", lastId)
            .eq("channel", channel)
            .order("id", { ascending: true })
            .limit(100);

          if (error) {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`
              )
            );
            await sleep(POLL_INTERVAL_MS);
            continue;
          }

          if (data && data.length > 0) {
            for (const row of data) {
              lastId = row.id;

              const event = {
                cop_version: row.cop_version,
                event_id: row.event_id,
                correlation_id: row.correlation_id,
                from: row.from_addr,
                channel: row.channel,
                event_type: row.event_type,
                payload: row.payload,
                metadata: row.metadata || {},
              };

              const sseChunk = `id: ${row.id}\nevent: ${row.event_type}\ndata: ${JSON.stringify(event)}\n\n`;

              controller.enqueue(encoder.encode(sseChunk));
            }
          }

          await sleep(POLL_INTERVAL_MS);
        }
      } catch (_err) {
        // La fermeture de la connexion (client ou plateforme) arrivera ici.
        controller.close();
      }
    },
    cancel() {
      // Rien de spécial à faire, la boucle se termine d'elle-même sur exception.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
