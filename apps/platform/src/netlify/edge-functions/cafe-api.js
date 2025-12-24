import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
} from "../../common/config/instanceConfig.edge.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Load instance config from supabase
  await loadInstanceConfig();

  const supabase = getSupabase();

  const url = new URL(req.url);
  // remove /api/cafe/ prefix
  const path = url.pathname.replace(/^\/api\/cafe\//, "");

  try {
    const body = await req.json().catch(() => ({}));

    // Helper to compute SHA-256 hex hash of a secret.
    async function hashSecret(s) {
      const enc = new TextEncoder();
      const data = enc.encode(s);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // --- SESSION MANAGEMENT ---
    if (path === "topics/create") {
      const {
        title,
        description,
        created_by,
        location_type,
        venue_name,
        geo_lat,
        geo_lon,
        session_purpose,
        confidential_level,
      } = body;

      // Generate Host Secret if not authenticated (or always, to allow delegation)
      const host_secret = crypto.randomUUID();
      // compute a SHA256 hex hash of the secret for storage only (use shared helper)
      const host_secret_hash = await hashSecret(host_secret);

      // Create a COP topic as session (topic)
      const { data, error } = await supabase
        .from("cop_topic")
        .insert([
          {
            title: title || "Nouvelle Session Café",
            metadata: {
              source: "cafe",
              location_type,
              venue_name,
              geo_lat,
              geo_lon,
              session_purpose,
              confidential_level,
            },
            created_by,
          },
        ])
        .select()
        .single();
      if (error) throw error;

      // Insert a host participant record in cop_participants - store hash only
      await supabase
        .from("cop_participants")
        .insert([
          {
            topic_id: data.id,
            user_id: created_by || null,
            display_handle: "Host",
            role: "host",
            metadata: { host_secret_hash },
          },
        ])
        .select();

      // return the plaintext secret to the caller for immediate use; stored hashed version is used for verification
      return new Response(JSON.stringify({ ...data, host_secret }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "topics/join") {
      const { topic_id, user_id, display_name, display_mode, device_role, guest_id } = body;

      // 1. Try to find existing participant in cop_participants
      let existing = null;

      if (user_id) {
        const { data } = await supabase
          .from("cop_participants")
          .select("*")
          .eq("topic_id", topic_id)
          .eq("user_id", user_id)
          .maybeSingle();
        existing = data;
      } else if (guest_id) {
        const { data } = await supabase
          .from("cop_participants")
          .select("*")
          .eq("id", guest_id)
          .eq("topic_id", topic_id)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        // Update connection info
        await supabase
          .from("cop_participants")
          .update({ last_active_at: new Date() })
          .eq("id", existing.id);
        return new Response(JSON.stringify(existing), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Create new participant in cop_participants
      const { data, error } = await supabase
        .from("cop_participants")
        .insert({
          topic_id: topic_id,
          user_id: user_id || null,
          display_handle: display_name || "Anonyme",
          role: "participant",
          metadata: { display_mode, device_role },
          mic_state: "off",
        })
        .select()
        .single();

      if (error) throw error;

      // emit event
      await supabase.from("cop_event").insert([
        {
          topic_id: topic_id,
          type: "participant_joined",
          payload: { participant_id: data.id, user_id },
          created_by: user_id || null,
        },
      ]);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PHASE & STRUCTURE ---
    if (path === "control/phase") {
      const { topic_id, phase, action, host_secret } = body;

      // Verify Host Secret: find host participant and check metadata.host_secret_hash
      let hostValid = false;
      const { data: participants } = await supabase
        .from("cop_participants")
        .select("*")
        .eq("topic_id", topic_id)
        .limit(1);
      if (participants && participants.length > 0) {
        // If created_by matches or metadata.host_secret_hash matches
        const host = participants.find((p) => p.role === "host");
        if (host) {
          if (!hostValid && host.metadata && host.metadata.host_secret_hash && host_secret) {
            const submittedHash = await hashSecret(host_secret);
            if (submittedHash === host.metadata.host_secret_hash) hostValid = true;
          }
        }
      }

      if (!hostValid && host_secret) {
        return new Response(JSON.stringify({ error: "Unauthorized Host Action" }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      // Create event to change phase
      const ev = await supabase
        .from("cop_event")
        .insert([
          {
            topic_id: topic_id,
            type: "phase_control",
            payload: { action, phase },
            created_by: null,
          },
        ])
        .select()
        .single();

      return new Response(JSON.stringify(ev), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- MIC CONTROL PLANE ---
    if (path === "control/mic") {
      const { participant_id, action, host_secret } = body;

      let newState = "off";
      if (action === "request") newState = "requesting";
      if (action === "grant") newState = "focused";
      if (action === "release") newState = "off";
      if (action === "queue") newState = "queued";

      // If an action requires host privileges (grant/release), validate host_secret
      if (action === "grant" || action === "release") {
        if (!host_secret)
          return new Response(JSON.stringify({ error: "host_secret required" }), {
            status: 403,
            headers: corsHeaders,
          });
        const { data: participantRow } = await supabase
          .from("cop_participants")
          .select("*")
          .eq("id", participant_id)
          .maybeSingle();
        if (!participantRow)
          return new Response(JSON.stringify({ error: "Participant not found" }), {
            status: 404,
            headers: corsHeaders,
          });
        const { data: participants } = await supabase
          .from("cop_participants")
          .select("*")
          .eq("topic_id", participantRow.topic_id)
          .limit(1);
        if (!participants || participants.length === 0)
          return new Response(JSON.stringify({ error: "Host not found" }), {
            status: 403,
            headers: corsHeaders,
          });
        const host = participants.find((p) => p.role === "host");
        if (!host)
          return new Response(JSON.stringify({ error: "Host not found" }), {
            status: 403,
            headers: corsHeaders,
          });
        const submittedHash = await hashSecret(host_secret);
        if (
          !host.metadata ||
          !host.metadata.host_secret_hash ||
          host.metadata.host_secret_hash !== submittedHash
        ) {
          return new Response(JSON.stringify({ error: "Unauthorized Host Action" }), {
            status: 403,
            headers: corsHeaders,
          });
        }
      }

      const { data, error } = await supabase
        .from("cop_participants")
        .update({ mic_state: newState })
        .eq("id", participant_id)
        .select()
        .single();

      // Emit event about mic change
      await supabase.from("cop_event").insert([
        {
          topic_id: data.topic_id,
          type: "mic_state_changed",
          payload: { participant_id, action, newState },
          created_by: null,
        },
      ]);

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- REACTIONS (Gestures) ---
    if (path === "reaction") {
      const { topic_id, participant_id, utterance_id, reaction_type } = body;

      // Store reaction in cop_event
      const { data, error } = await supabase
        .from("cop_event")
        .insert([
          {
            topic_id: topic_id,
            type: "reaction",
            payload: { participant_id, utterance_id, reaction_type },
            created_by: participant_id,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- UTTERANCE (DATA PLANE) ---
    if (path === "utterance") {
      const { topic_id, participant_id, text, speaker_type, duration_ms, speech_type } = body;

      // 1. Save transcript as a cop_event user_message
      const { data: eventRow, error } = await supabase
        .from("cop_event")
        .insert([
          {
            topic_id: topic_id,
            type: "user_message",
            payload: { text, participant_id, duration_ms, speech_type, speaker_type },
            created_by: participant_id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // 2. Optionally, create a cop_message view-compatible row (cop_messages view will reflect cop_event)
      // 3. Optionally create a cop_task for deep processing (ASR -> transcript normalization, RAG, etc.)
      // For now, just return the event row
      return new Response(JSON.stringify({ event: eventRow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown endpoint" }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};
