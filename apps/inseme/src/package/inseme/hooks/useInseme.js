// src/package/inseme/hooks/useInseme.js

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

import { storage } from "../../../lib/storage";
import {
  getConfig,
  loadInstanceConfig,
} from "../../../../../../packages/cop-host/src/config/instanceConfig.client";

export const OPHELIA_ID = "00000000-0000-0000-0000-000000000001";

export function useInseme(
  roomName,
  user,
  supabase,
  config = {},
  isSpectator = false
) {
  // Merge Vault configuration (optional)
  const vaultConfig = {
    opheliaUrl: getConfig("OPHELIA_URL"),
    ophelia: getConfig("OPHELIA_SETTINGS") || {}, // Expected to be a JSON object in vault
  };

  const effectiveConfig = {
    ...vaultConfig,
    ...config,
    ophelia: {
      ...vaultConfig.ophelia,
      ...config.ophelia,
    },
  };

  // Schema Adaptation: allow the consumer to specify their profile table name
  // Default to 'users' to match current implementation, but often 'profiles' in other projects.
  const PROFILE_TABLE = effectiveConfig.profileTable || "users";

  const [messages, setMessages] = useState([]);
  const [roomData, setRoomData] = useState({
    proposition: "Pas de proposition active.",
    results: {},
    votes: {},
    media: null,
    speechQueue: [],
    moderators: [],
    sessionStatus: "closed", // 'open' | 'closed'
    connectedUsers: [],
    agenda: [],
  });
  const [presenceState, setPresenceState] = useState({});
  const [ephemeralThoughts, setEphemeralThoughts] = useState([]);
  const [isOphéliaThinking, setIsOphéliaThinking] = useState(false);
  const [nativeLang, setNativeLang] = useState(
    localStorage.getItem("inseme_native_lang") || "fr"
  );
  const [isSilent, setIsSilent] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [roomMetadata, setRoomMetadata] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const timersRef = useRef({});
  const messageCountRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef(null);
  const keepAliveTimeoutRef = useRef(null);
  const sendMessageRef = useRef();
  const triggerOphéliaRef = useRef();
  const setPropositionRef = useRef();
  const generateReportRef = useRef();
  const promoteToPlenaryRef = useRef();
  const searchMemoryRef = useRef();
  const castVoteRef = useRef();

  // Derived state
  const pivotLang = roomMetadata?.settings?.pivot_lang || "fr";

  // 1. Fetch Room Metadata & System Prompt
  useEffect(() => {
    if (!roomName || !supabase) return;

    const loadConfig = async () => {
      // Try to find SaaS room metadata
      const { data: room, error } = await supabase
        .from("inseme_rooms")
        .select("*")
        .eq("slug", roomName)
        .maybeSingle();

      if (room) {
        setRoomMetadata(room);
        if (room.settings?.ophelia?.prompt) {
          setSystemPrompt(room.settings.ophelia.prompt);
        } else {
          const promptUrl = config.promptUrl || "/prompts/inseme.md";
          fetch(promptUrl)
            .then((res) => res.text())
            .then(setSystemPrompt);
        }
      } else {
        // Fallback to static prompt file
        const promptUrl = config.promptUrl || "/prompts/inseme.md";
        fetch(promptUrl)
          .then((res) => res.text())
          .then(setSystemPrompt)
          .catch((err) =>
            console.error("Erreur de chargement du prompt Ophélia:", err)
          );
      }

      // Add sessions discovery
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomName }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Erreur API sessions (${res.status}):`, errorText);
        } else {
          const text = await res.text();
          if (text) {
            const data = JSON.parse(text);
            if (data.sessions) setSessions(data.sessions);
          }
        }
      } catch (err) {
        console.error("Erreur découverte sessions:", err);
      }

      // Fetch Ophélia's identity from the configured profile table
      try {
        const { data: opheliaProfile } = await supabase
          .from(PROFILE_TABLE)
          .select("display_name, avatar_url")
          .eq("id", OPHELIA_ID)
          .maybeSingle();

        if (opheliaProfile) {
          console.log("Identity: Ophélia found in", PROFILE_TABLE);
          // We could store this in state if we want dynamic names/avatars
        }
      } catch (err) {
        console.warn(
          `Could not fetch Ophélia from ${PROFILE_TABLE}. Using default.`
        );
      }
    };

    loadConfig();
  }, [roomName, supabase, config.promptUrl]);

  const fetchMessages = useCallback(
    async (dateFrom = null, dateTo = null) => {
      if (!roomName || !supabase) return;

      // Use UUID if available, fallback to slug
      const targetRoomId = roomMetadata?.id || roomName;

      let dbQuery = supabase
        .from("inseme_messages")
        .select("*")
        .eq("room_id", targetRoomId)
        .order("created_at", { ascending: true });

      if (dateFrom) dbQuery = dbQuery.gte("created_at", dateFrom);
      if (dateTo) dbQuery = dbQuery.lte("created_at", dateTo);
      else dbQuery = dbQuery.limit(200);

      const { data, error } = await dbQuery;

      if (!error) {
        setMessages(data);
        processMessages(data);
        messageCountRef.current = data.length;
      }
    },
    [roomName, supabase, roomMetadata?.id]
  );

  const selectSession = (session) => {
    if (!session) {
      setCurrentSessionId(null);
      fetchMessages();
      return;
    }
    setCurrentSessionId(session.id);
    fetchMessages(session.start, session.end);
  };

  // 2. Main Subscription & Initial Fetch
  useEffect(() => {
    if (!roomName || !supabase) return;

    const targetRoomId = roomMetadata?.id || roomName;

    // PRESENCE LOGGING (JOIN)
    const logJoin = async () => {
      if (!user) return;
      const userName =
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "Anonyme";
      await supabase.from("inseme_messages").insert([
        {
          room_id: targetRoomId,
          user_id: user?.id,
          name: userName,
          message: "JOINED",
          type: "presence_log",
          metadata: { status: "join", ua: navigator.userAgent },
        },
      ]);
    };

    if (roomMetadata?.id) {
      logJoin();
    }

    fetchMessages();

    // REALTIME SUBSCRIPTION
    const channel = supabase.channel(`room:${roomName}`, {
      config: {
        presence: {
          key:
            user?.id || "spectator-" + Math.random().toString(36).substr(2, 9),
        },
      },
    });
    channelRef.current = channel;

    // Handle ephemeral vocal broadcasts
    channel.on("broadcast", { event: "vocal" }, ({ payload }) => {
      if (!isSilent) playVocal(payload.vocal_payload);
    });

    channel.on("broadcast", { event: "ephemeral_reasoning" }, ({ payload }) => {
      setEphemeralThoughts((prev) => [
        ...prev,
        {
          id: "ephemeral-" + Date.now(),
          ...payload,
          is_ephemeral: true,
        },
      ]);
    });

    channel.on("broadcast", { event: "keep_alive" }, ({ payload }) => {
      lastActivityRef.current = Date.now();
      if (keepAliveTimeoutRef.current) {
        clearTimeout(keepAliveTimeoutRef.current);
        keepAliveTimeoutRef.current = null;
      }
    });

    channel.on("broadcast", { event: "ai_thinking" }, ({ payload }) => {
      setIsOphéliaThinking(payload.status);
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "inseme_messages",
        filter: `room_id=eq.${targetRoomId}`,
      },
      (payload) => {
        const newMsg = payload.new;
        setMessages((prev) => [...prev, newMsg]);
        processMessage(newMsg);

        // 3. Proactive Trigger: Wake up Ophélia every 15 messages (more subtle)
        messageCountRef.current++;
        if (messageCountRef.current % 15 === 0 && newMsg.name !== "Ophélia") {
          triggerOphélia(
            "[SYSTÈME] : Tu interviens de manière proactive après une série d'échanges pour apporter un éclairage ou une synthèse."
          );
        }
      }
    );

    if (user) {
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          setPresenceState(state);

          const connected = Object.values(state)
            .flat()
            .map((p) => ({
              id: p.user_id,
              name: p.name,
              status: p.status || "online",
            }));
          setRoomData((prev) => ({ ...prev, connectedUsers: connected }));
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          // console.log('join', key, newPresences)
        })
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
          // console.log('leave', key, leftPresences)
        });
    }

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && user) {
        const userName =
          user?.user_metadata?.full_name ||
          user?.email?.split("@")[0] ||
          "Anonyme";
        await channel.track({
          user_id: user?.id,
          name: userName,
          status: "online",
          joined_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, [roomName, supabase, fetchMessages, roomMetadata?.id, user]);

  // 3. Proactive & Inactivity Trigger
  useEffect(() => {
    if (!roomName || !supabase || isSpectator) return;

    const checkInactivity = () => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      const connectedCount = roomData.connectedUsers?.length || 0;

      // Logic:
      // - If only 1 person, be more patient (2 mins)
      // - If group, intervention after 45s of silence
      const threshold = connectedCount <= 1 ? 120000 : 45000;

      if (
        idleTime >= threshold &&
        messages.length > 0 &&
        !keepAliveTimeoutRef.current
      ) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.name !== "Ophélia" && !isOphéliaThinking) {
          // Randomized delay between 2s and 12s to avoid collisions
          const randomDelay = Math.floor(Math.random() * 10000) + 2000;
          keepAliveTimeoutRef.current = setTimeout(async () => {
            // Re-check idle time before sending
            const reCheckNow = Date.now();
            if (reCheckNow - lastActivityRef.current >= threshold) {
              // The sender triggers Ophélia, triggerOphélia will handle broadcasts
              if (!isOphéliaThinking) {
                triggerOphélia(
                  "[SYSTÈME] : Il y a un silence dans la conversation. Interviens pour relancer le débat, poser une question ou faire une synthèse."
                );
              }
            }
            keepAliveTimeoutRef.current = null;
          }, randomDelay);
        }
      }
    };

    inactivityTimerRef.current = setInterval(checkInactivity, 10000);

    return () => {
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
      if (keepAliveTimeoutRef.current)
        clearTimeout(keepAliveTimeoutRef.current);
    };
  }, [
    messages,
    roomData.connectedUsers,
    isOphéliaThinking,
    roomName,
    supabase,
    isSpectator,
    user, // Added user to dependencies for sendMessage
  ]);

  const processMessages = (msgs) => {
    const state = {
      proposition: "Pas de proposition active.",
      results: {},
      votes: {},
      media: null,
      speechQueue: [],
      moderators: [],
    };
    msgs.forEach((msg) => updateStateWithMsg(state, msg));
    setRoomData(state);
  };

  const processMessage = (msg) => {
    lastActivityRef.current = Date.now();
    if (keepAliveTimeoutRef.current) {
      clearTimeout(keepAliveTimeoutRef.current);
      keepAliveTimeoutRef.current = null;
    }

    setRoomData((prev) => {
      const newState = { ...prev };
      updateStateWithMsg(newState, msg);
      return newState;
    });
  };

  const updateStateWithMsg = (state, msg) => {
    const text = msg.message.trim();

    // Auto-play vocal if present and not already handled by real-time broadcast
    // Note: Real-time broadcast uses vocal_payload, which is stripped before DB storage.
    // So if we see vocal_url here, it's likely a transcription message that needs playing.
    if (msg.metadata?.vocal_url && msg.user_id !== user?.id) {
      playVocal(msg.metadata.vocal_url);
    }

    if (msg.metadata?.vocal_payload) {
      playVocal(msg.metadata.vocal_payload);
    }

    // Handle typed messages first
    if (msg.type === "agenda_update") {
      state.agenda = msg.metadata?.agenda || [];
      return;
    }

    if (!text.toLowerCase().startsWith("inseme")) return;

    const parts = text.split(/\s+/);
    const command = parts[1]?.toLowerCase();
    const payload = parts.slice(2).join(" ");
    const userId = msg.user_id || msg.name;

    // Lifecycle Commands
    if (command === "open") {
      state.sessionStatus = "open";
    } else if (command === "close") {
      state.sessionStatus = "closed";
      state.proposition = "Session close.";
      state.votes = {};
      state.speechQueue = [];
    } else if (command === "?") {
      state.proposition = payload || "Proposition vide.";
      state.votes = {};
    } else if (command === "!") {
      state.votes = {};
      state.results = {};
      state.proposition = "Pas de proposition active.";
    } else if (
      ["live", "image", "pad", "wiki", "twitter", "facebook"].includes(command)
    ) {
      if (!payload || payload === "off" || payload === "-") {
        state.media = null;
      } else {
        state.media = { type: command, url: payload };
      }
    } else if (command === "agenda") {
      // Agenda Payload is JSON-stringified list of points
      try {
        // If payload is just "update", it might be a signal, but usually we expect content.
        // We actually support `type: 'agenda_update'` messages better than parsing "inseme agenda" text commands
        // because the payload is complex JSON.
        // However, if we receive "inseme agenda [JSON]", let's try to parse it.
        if (payload.startsWith("[")) {
          state.agenda = JSON.parse(payload);
        }
      } catch (e) {
        console.warn("Failed to parse agenda command:", e);
      }
    } else if (command === "bye") {
      state.votes[userId] = {
        type: "delegate",
        target: payload,
        name: msg.name,
      };
    } else if (command === "parole" || command === "technical") {
      if (!state.speechQueue.find((s) => s.userId === userId)) {
        state.speechQueue.push({ userId, name: msg.name, type: command });
      }
    } else {
      const voteType = command || "quiet";
      if (voteType === "quiet" || voteType === "off") {
        delete state.votes[userId];
      } else {
        state.votes[userId] = {
          type: voteType,
          name: msg.name,
          timestamp: msg.created_at,
        };
      }
    }

    const results = {};
    Object.values(state.votes).forEach((v) => {
      results[v.type] = (results[v.type] || 0) + 1;
    });
    state.results = results;
  };

  const playVocal = (payload) => {
    if (isSilent || !payload) return;

    let audio;
    if (payload.startsWith("http")) {
      // It's a URL (from Supabase Storage)
      audio = new Audio(payload);
    } else {
      // It's a Base64 payload (direct broadcast)
      audio = new Audio(`data:audio/mp3;base64,${payload}`);
    }

    audio
      .play()
      .catch((e) => console.warn("Auto-play bloqué par le navigateur:", e));
  };

  const searchMemory = useCallback(
    async (query) => {
      try {
        const res = await fetch("/api/vector-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "search",
            text: query,
            room_id: roomMetadata?.id || roomName,
          }),
        });
        const { documents } = await res.json();
        if (!documents || documents.length === 0)
          return "Aucun résultat pertinent trouvé.";

        return documents
          .map(
            (d) =>
              `- [${new Date(d.metadata?.created_at || Date.now()).toLocaleDateString()}] ${d.message.substring(0, 150)}...`
          )
          .join("\n");
      } catch (error) {
        console.error("Search Error:", error);
        return "Erreur lors de la recherche mémoire.";
      }
    },
    [roomMetadata?.id, roomName]
  );

  const sendMessage = useCallback(
    async (text, metadata = {}) => {
      if (!user || isSpectator) return; // Spectators can't send messages
      if (!text?.trim() && !metadata.type) return;
      if (!supabase) return;

      // Command Parsing for Language Control
      if (text.startsWith("inseme lang ")) {
        const lang = text.split(" ")[2];
        if (lang) {
          setNativeLang(lang);
          localStorage.setItem("inseme_native_lang", lang);
          // Use optimistic UI or a local system message (not stored in DB)
          // For now, we just return to avoid sending the command to DB
          return;
        }
      }

      if (text.startsWith("inseme pivot ")) {
        const lang = text.split(" ")[2];
        if (lang && roomMetadata) {
          // Update room settings in DB
          const newSettings = { ...roomMetadata.settings, pivot_lang: lang };
          await supabase
            .from("inseme_rooms")
            .update({ settings: newSettings })
            .eq("id", roomMetadata.id);
          // Optimistic update
          setRoomMetadata({ ...roomMetadata, settings: newSettings });
          return;
        }
      }

      // Strip large binary data from metadata before DB insertion
      const dbMetadata = { ...metadata };
      const localVocalPayload = dbMetadata.vocal_payload;
      delete dbMetadata.vocal_payload;

      let contentObj = {
        room_id: roomMetadata?.id || roomName,
        user_id: metadata.is_ai ? OPHELIA_ID : user?.id || null,
        name: metadata.is_ai
          ? "Ophélia"
          : user?.user_metadata?.full_name ||
            user?.email?.split("@")[0] ||
            "Anonyme",
        message: text,
        type: metadata.type || "chat",
        metadata: dbMetadata,
      };

      // Translation Logic (Translate-on-Write)
      if (
        !metadata.is_ai &&
        nativeLang !== pivotLang &&
        !text.toLowerCase().startsWith("inseme")
      ) {
        try {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, target_lang: pivotLang }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data?.translated_text) {
              contentObj.message = data.translated_text;
              contentObj.metadata = {
                ...contentObj.metadata,
                original: text,
                lang: nativeLang,
              };
            }
          }
        } catch (err) {
          console.error("Translation failed, sending original:", err);
        }
      }

      const { data, error } = await supabase
        .from("inseme_messages")
        .insert([contentObj])
        .select()
        .single();

      if (error) {
        console.error("Erreur lors de l'envoi du message:", error);
      }

      // Broadcast vocal payload separately (it's too large for Postgres changes payload)
      if (localVocalPayload && !error) {
        if (!isSilent) playVocal(localVocalPayload);

        channelRef.current?.send({
          type: "broadcast",
          event: "vocal",
          payload: {
            message_id: data.id,
            vocal_payload: localVocalPayload,
          },
        });
      }

      // Trigger AI if addressed
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes("ophélia") ||
        lowerText.includes("ophelia") ||
        lowerText.includes("hello") ||
        lowerText.includes("bonjour") ||
        lowerText.includes("salut")
      ) {
        triggerOphéliaRef.current?.(text);
      }

      if (
        text.startsWith("inseme parole") ||
        text.startsWith("inseme technical")
      ) {
        const userId = user?.id || "Anonyme";
        if (timersRef.current[userId]) clearTimeout(timersRef.current[userId]);
        timersRef.current[userId] = setTimeout(() => {
          castVoteRef.current?.("quiet");
        }, 30000);
      }

      return { error };
    },
    [
      user,
      isSpectator,
      supabase,
      roomMetadata,
      roomName,
      nativeLang,
      pivotLang,
      isSilent,
      setNativeLang,
      setRoomMetadata,
    ]
  );

  const setProposition = useCallback(async (text, isAi = false) => {
    return sendMessageRef.current?.(`inseme ? ${text}`, { is_ai: isAi });
  }, []);

  const generateReport = useCallback(async () => {
    setIsOphéliaThinking(true);
    try {
      await sendMessageRef.current?.(
        "**Édition du Procès-Verbal en cours...**",
        {
          is_ai: true,
        }
      );

      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          room_settings: roomMetadata?.settings,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Report API Error (${response.status}): ${errorText || "Unknown error"}`
        );
      }

      const data = await response.json();
      const { report, error } = data || {};

      if (error) throw new Error(error);

      if (report) {
        const { data, error: insertError } = await supabase
          .from("inseme_messages")
          .insert([
            {
              room_id: roomMetadata?.id || roomName, // UUID
              user_id: null,
              name: "Ophélia",
              message: report,
              type: "chat", // Should be 'chat' or custom type? 'chat' ensures visibility.
              metadata: { type: "report", generated: true },
            },
          ])
          .select();

        if (insertError) throw new Error(insertError.message);

        if (data && data[0]) {
          // AUTO-EMBED
          await fetch("/api/vector-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "embed",
              text: report,
              id: data[0].id,
            }),
          });

          // Checkpoint Update (Optional: could notify room settings)
        }

        await sendMessageRef.current?.(
          "📜 Le Procès-Verbal a été généré et archivé.",
          {
            is_ai: true,
          }
        );
      }
    } catch (error) {
      console.error("Erreur Report:", error);
      await sendMessageRef.current?.(
        "[Erreur] Génération du rapport échouée.",
        {
          is_ai: true,
        }
      );
    } finally {
      setIsOphéliaThinking(false);
    }
  }, [messages, roomMetadata, roomName, supabase]);

  const promoteToPlenary = useCallback(
    async (content) => {
      const parentSlug = roomMetadata?.settings?.parent_slug;
      if (!parentSlug) {
        await sendMessageRef.current?.(
          "[Erreur] Impossible de remonter à la plénière : aucune salle parente configurée.",
          { is_ai: true }
        );
        return;
      }

      setIsOphéliaThinking(true);
      try {
        await sendMessageRef.current?.(
          `**Transmission à la Plénière (${parentSlug})...**`,
          {
            is_ai: true,
          }
        );

        // In a real SaaS, we would use the Edge Function to securely post to another room.
        // For this implementation, we will simulate it or use a direct Supabase call if we have permissions.
        // Since we rely on RLS, writing to another room might be restricted unless we are also an owner/member.
        // Let's assume for now we use a server-side function or the user has rights.

        // NOTE: Ideally, we should create a dedicated Edge Function /api/promote to handle cross-room writes securely.
        // For now, let's try to write directly using the client if possible, flagging it as a "proposition".

        // To properly resolve the slug to a UUID, we need a lookup.
        // Since we don't have the parent's UUID easily here without a lookup, we'll implement a simple lookup via Supabase.
        const { data: parentRoom } = await supabase
          .from("inseme_rooms")
          .select("id")
          .eq("slug", parentSlug)
          .single();

        if (parentRoom) {
          const { data: msgData, error: insertError } = await supabase
            .from("inseme_messages")
            .insert([
              {
                room_id: parentRoom.id, // Using the resolved UUID
                user_id: user?.id,
                name: `Commission (${roomMetadata.name})`,
                message: `**Proposition de la Commission :**\n\n${content}`,
                type: "proposition",
                metadata: {
                  source_room: roomMetadata?.id || roomName,
                  promoted: true,
                },
              },
            ])
            .select();

          if (insertError) throw new Error(insertError.message);

          if (msgData && msgData[0]) {
            // AUTO-EMBED in Parent Room
            await fetch("/api/vector-search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "embed",
                text: content,
                id: msgData[0].id,
              }),
            });
          }

          await sendMessageRef.current?.(
            `✅ Transmis avec succès à la plénière.`,
            {
              is_ai: true,
            }
          );
        } else {
          throw new Error("Salle parente introuvable.");
        }
      } catch (error) {
        console.error("Erreur Promotion:", error);
        await sendMessageRef.current?.(
          `[Erreur] Échec de la transmission : ${error.message}`,
          { is_ai: true }
        );
      } finally {
        setIsOphéliaThinking(false);
      }
    },
    [roomMetadata, user?.id, roomName, supabase]
  );

  const archiveReport = useCallback(
    async (reportText) => {
      if (!roomMetadata?.id) return;
      try {
        const sessionId = currentSessionId || `manual-${Date.now()}`;
        const fileName = `reports/${roomName}/${sessionId}.md`;
        const blob = new Blob([reportText], { type: "text/markdown" });

        const { url } = await storage.upload(
          "public-documents",
          fileName,
          blob
        );

        await sendMessageRef.current?.(
          `📄 **PV Archivé dans le Cloud**\nLien : [Consulter le document](${url})`,
          {
            is_ai: true,
            type: "system_summary",
            metadata: {
              type: "archive_link",
              url,
            },
          }
        );
        return url;
      } catch (err) {
        console.error("Erreur d'archivage:", err);
        throw err;
      }
    },
    [roomMetadata?.id, currentSessionId, roomName]
  );

  const uploadVocal = useCallback(
    async (blob, customFileName = null) => {
      if (!roomMetadata?.id) return null;
      return storage.uploadVocal(roomMetadata.id, blob, customFileName);
    },
    [roomMetadata?.id]
  );

  const castVote = useCallback(
    async (option) => {
      if (!user) return;
      const userName =
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "Anonyme";

      // 1. Send as a system message to trigger real-time updates via subscription
      await sendMessageRef.current?.(`inseme vote ${option}`, {
        type: "vote",
        metadata: {
          option,
          user_name: userName,
          is_flash_poll: true,
        },
      });
    },
    [user]
  );

  const startSession = () => sendMessageRef.current?.("inseme open");
  const endSession = () => {
    sendMessageRef.current?.("inseme close");
    generateReportRef.current?.();
  };
  const updateAgenda = (newAgenda) =>
    sendMessageRef.current?.(`inseme agenda [Mise à jour de l'ordre du jour]`, {
      type: "agenda_update",
      agenda: newAgenda,
    });
  const onParole = () => sendMessageRef.current?.("inseme parole");
  const onDelegate = (target) =>
    sendMessageRef.current?.(`inseme bye ${target}`);

  const triggerOphélia = useCallback(
    async (userIntent = null) => {
      if (isOphéliaThinking) return;

      // Broadcast that we are starting to think
      channelRef.current?.send({
        type: "broadcast",
        event: "ai_thinking",
        payload: { status: true },
      });
      // Also broadcast a keep_alive to reset everyone's timers
      channelRef.current?.send({
        type: "broadcast",
        event: "keep_alive",
        payload: { user_id: user?.id },
      });

      setIsOphéliaThinking(true);
      lastActivityRef.current = Date.now();

      try {
        // Calculate speech statistics for Ophélia
        const speechStats = messages.reduce((acc, m) => {
          const duration = m.metadata?.voice_duration || 0;
          if (duration > 0) {
            acc[m.name] = (acc[m.name] || 0) + duration;
          }
          return acc;
        }, {});

        const statsContext =
          Object.entries(speechStats).length > 0
            ? `\n\n[CONTEXTE TEMPS DE PAROLE] : ${Object.entries(speechStats)
                .map(([name, time]) => `${name}: ${time}s`)
                .join(", ")}`
            : "";

        const history = messages.slice(-100).map((m) => ({
          role: m.name === "Ophélia" ? "assistant" : "user",
          content: `${m.name}: ${m.message}${m.metadata?.voice_duration ? ` (Vocal: ${m.metadata.voice_duration}s)` : ""}`,
        }));

        if (userIntent) {
          history.push({
            role: "user",
            content: `Message direct à Ophélia: ${userIntent}${statsContext}`,
          });
        } else if (statsContext) {
          // If proactive trigger, inject stats in the last message or as a system hint
          const lastMsg = history[history.length - 1];
          if (lastMsg) lastMsg.content += statsContext;
        }

        // Enhanced logic: Ophélia can now trigger flash polls
        // We inject the tool definition in her context
        const tools = [
          { name: "send_message", description: "Send a standard message" },
          {
            name: "flash_poll",
            description: "Trigger a quick Pour/Contre/Abstention poll",
          },
          {
            name: "generate_report",
            description: "Close session and generate PV",
          },
        ];

        const opheliaUrl = effectiveConfig.opheliaUrl || "/api/ophelia";
        const response = await fetch(opheliaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "chat",
            room_id: roomMetadata?.id || roomName,
            content: history,
            context: roomData,
            system_prompt: systemPrompt,
            room_settings: {
              ...roomMetadata?.settings,
              ophelia: {
                ...roomMetadata?.settings?.ophelia,
                ...effectiveConfig.ophelia, // Hook-level overrides (api_url, model, etc)
              },
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `API Error (${response.status}): ${errorText || "Unknown error"}`
          );
        }

        const data = await response.json();
        const { actions, text } = data || {};

        if (actions && actions.length > 0) {
          for (const action of actions) {
            const { tool, args, vocal_payload } = action;

            if (tool === "send_message") {
              await sendMessageRef.current?.(args.text, {
                is_ai: true,
                vocal_payload,
              });
            } else if (tool === "speak") {
              await sendMessageRef.current?.(args.text, {
                is_ai: true,
                vocal_payload,
                vocal_only: true,
              });
            } else if (tool === "set_proposition") {
              await setPropositionRef.current?.(args.text, true);
            } else if (tool === "manage_speech_queue") {
              await sendMessageRef.current?.(
                `[Médiation] ${args.action === "invite" ? "Invitons" : "Retirons"} ${args.userId} de la liste.`,
                { is_ai: true }
              );
            } else if (tool === "generate_report") {
              await generateReportRef.current?.();
            } else if (tool === "promote_to_plenary") {
              await promoteToPlenaryRef.current?.(args.content);
            } else if (tool === "search_memory") {
              const results = await searchMemoryRef.current?.(args.query);
              await sendMessageRef.current?.(
                `[Mémoire] Résultats pour "${args.query}" :\n${results}`,
                { is_ai: true, type: "system_summary" }
              );
            } else if (tool === "consult_archives") {
              await sendMessageRef.current?.(
                `🔍 *Je consulte les archives pour "${args.query || "..."}"...*`,
                { is_ai: true }
              );
              try {
                const res = await fetch("/api/history", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    query: args.query,
                    filters: {
                      room_id: roomMetadata?.id || roomName,
                      ...args,
                    },
                  }),
                });

                if (!res.ok)
                  throw new Error(`History API Error: ${res.status}`);

                const data = await res.json();
                const { results } = data || {};

                const formatted =
                  results && results.length > 0
                    ? results
                        .map(
                          (r) =>
                            `- [${new Date(r.created_at).toLocaleString()}] ${r.name} (${r.type}): ${r.message}`
                        )
                        .join("\n")
                    : "Aucun résultat trouvé dans les archives.";

                await sendMessageRef.current?.(
                  `[ARCHIVES] Résultat de la recherche :\n${formatted}`,
                  { is_ai: true, type: "system_summary" }
                );
              } catch (e) {
                console.error("Archive Error:", e);
                await sendMessageRef.current?.(
                  `[Erreur] Consultation échouée: ${e.message}`,
                  {
                    is_ai: true,
                  }
                );
              }
            }
          }
        } else if (text) {
          let opheliaMsg = text;
          let metadata = { is_ai: true };

          // --- Ephemeral Reasoning (Think) Handling ---
          const thinkMatch = opheliaMsg.match(/<think>([\s\S]*?)<\/think>/);
          if (thinkMatch) {
            const reasoning = thinkMatch[1].trim();
            opheliaMsg = opheliaMsg
              .replace(/<think>[\s\S]*?<\/think>/, "")
              .trim();

            channelRef.current?.send({
              type: "broadcast",
              event: "ephemeral_reasoning",
              payload: {
                reasoning,
                name: "Ophélia",
                timestamp: new Date().toISOString(),
              },
            });
          }

          if (opheliaMsg.includes("FLASH_POLL:")) {
            const pollQuestion = opheliaMsg.split("FLASH_POLL:")[1].trim();
            opheliaMsg = pollQuestion;
            metadata = {
              ...metadata,
              type: "flash_poll",
              is_system: true,
            };
          }

          await sendMessageRef.current?.(opheliaMsg, metadata);
        }
      } catch (err) {
        console.error("Erreur Agent Ophélia:", err);
      } finally {
        setIsOphéliaThinking(false);
        // Broadcast that we finished thinking
        channelRef.current?.send({
          type: "broadcast",
          event: "ai_thinking",
          payload: { status: false },
        });
      }
    },
    [
      isOphéliaThinking,
      messages,
      roomMetadata,
      roomName,
      roomData,
      systemPrompt,
      effectiveConfig,
      user?.id,
    ]
  );

  // Keep refs in sync with latest versions to break circular dependencies
  useEffect(() => {
    sendMessageRef.current = sendMessage;
    triggerOphéliaRef.current = triggerOphélia;
    setPropositionRef.current = setProposition;
    generateReportRef.current = generateReport;
    promoteToPlenaryRef.current = promoteToPlenary;
    searchMemoryRef.current = searchMemory;
    castVoteRef.current = castVote;
  }, [
    sendMessage,
    triggerOphélia,
    setProposition,
    generateReport,
    promoteToPlenary,
    searchMemory,
    castVote,
  ]);

  const sendMessage = useCallback(
    async (text, metadata = {}) => {
      if (!user || isSpectator) return; // Spectators can't send messages
      if (!text?.trim() && !metadata.type) return;
      if (!supabase) return;

      // Command Parsing for Language Control
      if (text.startsWith("inseme lang ")) {
        const lang = text.split(" ")[2];
        if (lang) {
          setNativeLang(lang);
          localStorage.setItem("inseme_native_lang", lang);
          // Use optimistic UI or a local system message (not stored in DB)
          // For now, we just return to avoid sending the command to DB
          return;
        }
      }

      if (text.startsWith("inseme pivot ")) {
        const lang = text.split(" ")[2];
        if (lang && roomMetadata) {
          // Update room settings in DB
          const newSettings = { ...roomMetadata.settings, pivot_lang: lang };
          await supabase
            .from("inseme_rooms")
            .update({ settings: newSettings })
            .eq("id", roomMetadata.id);
          // Optimistic update
          setRoomMetadata({ ...roomMetadata, settings: newSettings });
          return;
        }
      }

      // Strip large binary data from metadata before DB insertion
      const dbMetadata = { ...metadata };
      const localVocalPayload = dbMetadata.vocal_payload;
      delete dbMetadata.vocal_payload;

      let contentObj = {
        room_id: roomMetadata?.id || roomName,
        user_id: metadata.is_ai ? OPHELIA_ID : user?.id || null,
        name: metadata.is_ai
          ? "Ophélia"
          : user?.user_metadata?.full_name ||
            user?.email?.split("@")[0] ||
            "Anonyme",
        message: text,
        type: metadata.type || "chat",
        metadata: dbMetadata,
      };

      // Translation Logic (Translate-on-Write)
      if (
        !metadata.is_ai &&
        nativeLang !== pivotLang &&
        !text.toLowerCase().startsWith("inseme")
      ) {
        try {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, target_lang: pivotLang }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data?.translated_text) {
              contentObj.message = data.translated_text;
              contentObj.metadata = {
                ...contentObj.metadata,
                original: text,
                lang: nativeLang,
              };
            }
          }
        } catch (err) {
          console.error("Translation failed, sending original:", err);
        }
      }

      const { data, error } = await supabase
        .from("inseme_messages")
        .insert([contentObj])
        .select()
        .single();

      if (error) {
        console.error("Erreur lors de l'envoi du message:", error);
      }

      // Broadcast vocal payload separately (it's too large for Postgres changes payload)
      if (localVocalPayload && !error) {
        if (!isSilent) playVocal(localVocalPayload);

        channelRef.current?.send({
          type: "broadcast",
          event: "vocal",
          payload: {
            message_id: data.id,
            vocal_payload: localVocalPayload,
          },
        });
      }

      // Trigger AI if addressed
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes("ophélia") ||
        lowerText.includes("ophelia") ||
        lowerText.includes("hello") ||
        lowerText.includes("bonjour") ||
        lowerText.includes("salut")
      ) {
        triggerOphéliaRef.current?.(text);
      }

      if (
        text.startsWith("inseme parole") ||
        text.startsWith("inseme technical")
      ) {
        const userId = user?.id || "Anonyme";
        if (timersRef.current[userId]) clearTimeout(timersRef.current[userId]);
        timersRef.current[userId] = setTimeout(() => {
          castVote("quiet");
        }, 30000);
      }

      return { error };
    },
    [
      user,
      isSpectator,
      supabase,
      roomMetadata,
      roomName,
      nativeLang,
      pivotLang,
      isSilent,
      setNativeLang,
      setRoomMetadata,
      castVote,
    ]
  );

  const generateReport = async () => {
    setIsOphéliaThinking(true);
    try {
      await sendMessage("**Édition du Procès-Verbal en cours...**", {
        is_ai: true,
      });

      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          room_settings: roomMetadata?.settings,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Report API Error (${response.status}): ${errorText || "Unknown error"}`
        );
      }

      const data = await response.json();
      const { report, error } = data || {};

      if (error) throw new Error(error);

      if (report) {
        const { data, error: insertError } = await supabase
          .from("inseme_messages")
          .insert([
            {
              room_id: roomMetadata?.id || roomName, // UUID
              user_id: null,
              name: "Ophélia",
              message: report,
              type: "chat", // Should be 'chat' or custom type? 'chat' ensures visibility.
              metadata: { type: "report", generated: true },
            },
          ])
          .select();

        if (insertError) throw new Error(insertError.message);

        if (data && data[0]) {
          // AUTO-EMBED
          await fetch("/api/vector-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "embed",
              text: report,
              id: data[0].id,
            }),
          });

          // Checkpoint Update (Optional: could notify room settings)
        }

        await sendMessage("📜 Le Procès-Verbal a été généré et archivé.", {
          is_ai: true,
        });
      }
    } catch (error) {
      console.error("Erreur Report:", error);
      await sendMessage("[Erreur] Génération du rapport échouée.", {
        is_ai: true,
      });
    } finally {
      setIsOphéliaThinking(false);
    }
  };

  const promoteToPlenary = async (content) => {
    const parentSlug = roomMetadata?.settings?.parent_slug;
    if (!parentSlug) {
      await sendMessage(
        "[Erreur] Impossible de remonter à la plénière : aucune salle parente configurée.",
        { is_ai: true }
      );
      return;
    }

    setIsOphéliaThinking(true);
    try {
      await sendMessage(`**Transmission à la Plénière (${parentSlug})...**`, {
        is_ai: true,
      });

      // In a real SaaS, we would use the Edge Function to securely post to another room.
      // For this implementation, we will simulate it or use a direct Supabase call if we have permissions.
      // Since we rely on RLS, writing to another room might be restricted unless we are also an owner/member.
      // Let's assume for now we use a server-side function or the user has rights.

      // NOTE: Ideally, we should create a dedicated Edge Function /api/promote to handle cross-room writes securely.
      // For now, let's try to write directly using the client if possible, flagging it as a "proposition".

      // To properly resolve the slug to a UUID, we need a lookup.
      // Since we don't have the parent's UUID easily here without a lookup, we'll implement a simple lookup via Supabase.
      const { data: parentRoom } = await supabase
        .from("inseme_rooms")
        .select("id")
        .eq("slug", parentSlug)
        .single();

      if (parentRoom) {
        const { data: msgData, error: insertError } = await supabase
          .from("inseme_messages")
          .insert([
            {
              room_id: parentRoom.id, // Using the resolved UUID
              user_id: user?.id,
              name: `Commission (${roomMetadata.name})`,
              message: `**Proposition de la Commission :**\n\n${content}`,
              type: "proposition",
              metadata: {
                source_room: roomMetadata?.id || roomName,
                promoted: true,
              },
            },
          ])
          .select();

        if (insertError) throw new Error(insertError.message);

        if (msgData && msgData[0]) {
          // AUTO-EMBED in Parent Room
          await fetch("/api/vector-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "embed",
              text: content,
              id: msgData[0].id,
            }),
          });
        }

        await sendMessage(`✅ Transmis avec succès à la plénière.`, {
          is_ai: true,
        });
      } else {
        throw new Error("Salle parente introuvable.");
      }
    } catch (error) {
      console.error("Erreur Promotion:", error);
      await sendMessage(
        `[Erreur] Échec de la transmission : ${error.message}`,
        { is_ai: true }
      );
    } finally {
      setIsOphéliaThinking(false);
    }
  };

  const searchMemory = async (query) => {
    try {
      const res = await fetch("/api/vector-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          text: query,
          room_id: roomMetadata?.id || roomName,
        }),
      });
      const { documents } = await res.json();
      if (!documents || documents.length === 0)
        return "Aucun résultat pertinent trouvé.";

      return documents
        .map(
          (d) =>
            `- [${new Date(d.metadata?.created_at || Date.now()).toLocaleDateString()}] ${d.message.substring(0, 150)}...`
        )
        .join("\n");
    } catch (error) {
      console.error("Search Error:", error);
      return "Erreur lors de la recherche mémoire.";
    }
  };

  const archiveReport = async (reportText) => {
    if (!roomMetadata?.id) return;
    try {
      const sessionId = currentSessionId || `manual-${Date.now()}`;
      const fileName = `reports/${roomName}/${sessionId}.md`;
      const blob = new Blob([reportText], { type: "text/markdown" });

      const { url } = await storage.upload("public-documents", fileName, blob);

      await sendMessage(
        `📄 **PV Archivé dans le Cloud**\nLien : [Consulter le document](${url})`,
        {
          is_ai: true,
          type: "system_summary",
          metadata: {
            type: "archive_link",
            url,
          },
        }
      );
      return url;
    } catch (err) {
      console.error("Erreur d'archivage:", err);
      throw err;
    }
  };

  const uploadVocal = async (blob, customFileName = null) => {
    if (!roomMetadata?.id) return null;
    return storage.uploadVocal(roomMetadata.id, blob, customFileName);
  };

  const startSession = () => sendMessage("inseme open");
  const endSession = () => {
    sendMessage("inseme close");
    generateReport();
  };
  const updateAgenda = (newAgenda) =>
    sendMessage(`inseme agenda [Mise à jour de l'ordre du jour]`, {
      type: "agenda_update",
      agenda: newAgenda,
    });
  const castVote = async (option) => {
    if (!user) return;
    const userName =
      user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonyme";

    // 1. Send as a system message to trigger real-time updates via subscription
    await sendMessage(`inseme vote ${option}`, {
      type: "vote",
      metadata: {
        option,
        user_name: userName,
        is_flash_poll: true,
      },
    });
  };
  const onParole = () => sendMessage("inseme parole");
  const onDelegate = (target) => sendMessage(`inseme bye ${target}`);

  return {
    roomName,
    user,
    isSpectator,
    messages,
    ephemeralThoughts,
    roomData,
    roomMetadata,
    sendMessage,
    askOphélia: triggerOphélia,
    isOphéliaThinking,
    nativeLang,
    setNativeLang,
    isSilent,
    setIsSilent,
    archiveReport,
    startSession,
    endSession,
    updateAgenda,
    castVote,
    onParole,
    onDelegate,
    sessions,
    currentSessionId,
    selectSession,
    presenceState,
    uploadVocal,
    playVocal,
  };
}
