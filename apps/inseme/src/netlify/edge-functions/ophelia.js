import OpenAI from "https://esm.sh/openai@4";
import postgres from "https://deno.land/x/postgresjs/mod.js";
import { defineEdgeFunction } from "../../../../../packages/cop-host/src/runtime/edge.js";
import { performWebSearch } from "../../../../../packages/ophelia/websearch.js";

export const config = {
  path: "/api/ophelia",
};

export default defineEdgeFunction(async (request, runtime, context) => {
  const { getConfig, json, error } = runtime;

  try {
    let body = {};
    try {
      if (request.body) {
        body = await request.json();
      }
    } catch (e) {
      console.warn("[Ophelia] Malformed JSON or empty body");
    }

    const {
      content: messages,
      system_prompt,
      room_settings,
      room_id,
      agenda,
      is_silent,
      speech_stats,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return error("messages array is required", 400);
    }

    const apiKey = getConfig("OPENAI_API_KEY");
    if (!apiKey) return error("OPENAI_API_KEY missing", 500);

    const dbUrl = getConfig("DATABASE_URL");
    const braveKey = getConfig("brave_search_api_key");

    const openai = new OpenAI({ apiKey });
    let sql = null;
    if (dbUrl) {
      sql = postgres(dbUrl, { ssl: "require", prepare: false });
    }

    // 0. Load Room Knowledge (Memory) & Consents
    let roomKnowledgeContext = "";
    let consentsContext = "";
    let onboardingWarning = "";
    let temperatureAnalysis = "";
    let speechStatsContext = "";

    if (speech_stats) {
      speechStatsContext = `\n\n[STATISTIQUES DE PAROLE] :\n${Object.entries(
        speech_stats
      )
        .map(([id, time]) => `- ${id} : ${Math.round(time)} secondes`)
        .join("\n")}`;
    }

    if (sql && room_id) {
      try {
        const lastUserMessage = messages.filter((m) => m.role === "user").pop();
        const currentUserId =
          lastUserMessage?.name || lastUserMessage?.author_id;

        // Analyse rapide de la température du débat (basée sur les derniers messages)
        const recentMessages = messages
          .slice(-5)
          .map((m) => m.content)
          .join(" ");
        const aggressiveWords = [
          "colère",
          "haine",
          "idiot",
          "n'importe quoi",
          "menteur",
          "agressif",
          "insulte",
        ];
        const tensionKeywords = aggressiveWords.filter((word) =>
          recentMessages.toLowerCase().includes(word)
        );

        if (tensionKeywords.length > 0) {
          temperatureAnalysis = `\n\n[ANALYSE DU CLIMAT] : Tension détectée (${tensionKeywords.length} mots-clés agressifs). Priorise la médiation CNV et propose une carte du débat si nécessaire.`;
        }

        const knowledgeRows = await sql`
          SELECT message, metadata 
          FROM inseme_messages 
          WHERE room_id = ${room_id} 
          AND type = 'knowledge' 
          ORDER BY created_at DESC 
          LIMIT 50
        `;

        if (knowledgeRows.length > 0) {
          const generalKnowledge = knowledgeRows
            .filter(
              (k) =>
                k.metadata?.category !== "preference" ||
                !k.message.includes("accepté les conditions")
            )
            .slice(0, 10);

          const consents = knowledgeRows.filter(
            (k) =>
              k.metadata?.category === "preference" &&
              k.message.includes("accepté les conditions")
          );

          if (generalKnowledge.length > 0) {
            roomKnowledgeContext =
              "\n\n[MÉMOIRE CONSOLIDÉE DE LA SALLE] :\n" +
              generalKnowledge
                .map(
                  (k) => `- [${k.metadata?.category || "info"}] : ${k.message}`
                )
                .join("\n");
          }

          if (consents.length > 0) {
            consentsContext =
              "\n\n[CONSENTEMENTS ENREGISTRÉS] :\n" +
              consents.map((c) => `- ${c.message}`).join("\n");

            // Vérifier si l'utilisateur actuel a déjà consenti
            if (currentUserId) {
              const hasConsented = consents.some(
                (c) =>
                  c.metadata?.participant_id === currentUserId ||
                  c.message.includes(currentUserId)
              );
              if (!hasConsented) {
                onboardingWarning = `\n\n[ALERTE SYSTÈME] : L'utilisateur actuel (${currentUserId}) n'a pas encore explicitement accepté les conditions de transparence. Tu DOIS commencer ta réponse par un rappel amical du principe "Zéro Secret" et lui demander son consentement avant d'aller plus loin dans l'échange personnalisé.`;
              }
            }
          } else if (currentUserId) {
            // Aucun consentement dans la salle du tout
            onboardingWarning = `\n\n[ALERTE SYSTÈME] : Aucun consentement enregistré dans cette salle. Tu DOIS rappeler le principe de transparence "Zéro Secret" à l'utilisateur (${currentUserId}).`;
          }
        } else if (currentUserId) {
          onboardingWarning = `\n\n[ALERTE SYSTÈME] : Premier échange détecté. Tu DOIS présenter le principe de transparence "Zéro Secret" à l'utilisateur (${currentUserId}) et recueillir son consentement.`;
        }
      } catch (e) {
        console.warn("[Ophelia] Error loading knowledge:", e);
      }
    }

    // 1. Prepare Tools
    const tools = [
      {
        type: "function",
        function: {
          name: "report_to_moderation",
          description:
            "Signaler un comportement grave (insultes répétées, propos illégaux, haineux) aux administrateurs de la salle. Utilise cet outil après avoir tenté un rappel à l'ordre.",
          parameters: {
            type: "object",
            properties: {
              user_id: {
                type: "string",
                description: "L'ID de l'utilisateur concerné.",
              },
              reason: {
                type: "string",
                description: "Le motif précis du signalement.",
              },
              severity: {
                type: "string",
                enum: ["warning", "report", "critical"],
                description: "Le niveau de gravité.",
              },
            },
            required: ["user_id", "reason", "severity"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_debate_map",
          description:
            "Générer une carte structurée du débat actuel pour clarifier les échanges. Utilise cet outil quand le débat devient confus ou tendu.",
          parameters: {
            type: "object",
            properties: {
              consensus: {
                type: "array",
                items: { type: "string" },
                description:
                  "Liste des points sur lesquels un accord semble acquis.",
              },
              frictions: {
                type: "array",
                items: { type: "string" },
                description:
                  "Liste des points de désaccord identifiés, formulés de manière neutre.",
              },
              open_questions: {
                type: "array",
                items: { type: "string" },
                description: "Questions restant à trancher pour avancer.",
              },
            },
            required: ["consensus", "frictions", "open_questions"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "sql_query",
          description:
            "Exécuter une requête SQL en lecture seule (SELECT) pour accéder aux données de Kudocracy ou découvrir la structure de la base (introspection). Utilise cet outil pour des analyses, des statistiques, ou pour lister les tables et colonnes via information_schema.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "La requête SQL SELECT à exécuter (lecture seule).",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "persist_knowledge",
          description:
            "Sauvegarder une connaissance importante pour la salle (schéma découvert, faits marquants, préférences). IMPORTANT : Pour les informations personnelles ou préférences de participants, assure-toi d'avoir obtenu un consentement explicite ou d'avoir résumé publiquement ce que tu mémorises.",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["db_schema", "fact", "preference", "summary"],
                description: "La catégorie de la connaissance.",
              },
              content: {
                type: "string",
                description:
                  "Le contenu textuel ou JSON de la connaissance à mémoriser.",
              },
              participant_id: {
                type: "string",
                description: "L'ID du participant concerné (optionnel).",
              },
            },
            required: ["category", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "forget_knowledge",
          description:
            "Supprimer une connaissance précédemment mémorisée. Utile si une information est devenue obsolète ou si un participant exerce son droit à l'oubli.",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["db_schema", "fact", "preference", "summary"],
                description: "La catégorie à nettoyer.",
              },
              search_term: {
                type: "string",
                description:
                  "Terme clé pour identifier la connaissance à supprimer dans le message.",
              },
            },
            required: ["category", "search_term"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "internal_monologue",
          description:
            "Enregistrer une réflexion méta-cognitive sur la stratégie de médiation. Ce monologue est interne (non affiché directement) mais guide tes décisions futures.",
          parameters: {
            type: "object",
            properties: {
              thought: {
                type: "string",
                description:
                  "Ta réflexion sur l'état du débat, ton propre comportement, ou ta stratégie à venir.",
              },
              climat_score: {
                type: "integer",
                minimum: 1,
                maximum: 10,
                description:
                  "Ton évaluation de la tension du débat (1: calme, 10: critique).",
              },
            },
            required: ["thought", "climat_score"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "suggest_action",
          description:
            "Proposer une action collective à l'assemblée sans l'imposer. Cela crée des boutons d'action cliquables pour les participants.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description:
                  "Le titre court de la suggestion (ex: 'Passer au vote').",
              },
              description: {
                type: "string",
                description:
                  "L'explication de pourquoi cette action est suggérée.",
              },
              action_type: {
                type: "string",
                enum: [
                  "set_proposition",
                  "flash_poll",
                  "create_debate_map",
                  "generate_report",
                  "close_topic",
                ],
                description: "Le type d'action suggérée.",
              },
              suggested_args: {
                type: "object",
                description:
                  "Les arguments qui seraient utilisés si l'action était validée.",
              },
            },
            required: ["title", "description", "action_type"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "fact_check",
          description:
            "Vérifier une affirmation factuelle ou chiffrée. Fournit une réponse structurée avec sources.",
          parameters: {
            type: "object",
            properties: {
              claim: {
                type: "string",
                description: "L'affirmation à vérifier.",
              },
              context: {
                type: "string",
                description: "Le contexte de l'affirmation.",
              },
            },
            required: ["claim"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "web_search",
          description:
            "Rechercher des informations actualisées sur Internet via Brave Search.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "La requête de recherche.",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "send_message",
          description:
            "Participer au chat textuel pour donner un avis, une synthèse ou relancer le débat.",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: "Le contenu du message." },
              with_voice: {
                type: "boolean",
                description: "Si vrai, Ophélia parlera aussi ce message.",
              },
            },
            required: ["text"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "speak",
          description:
            "Intervenir uniquement oralement (sans message texte visible dans le chat).",
          parameters: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Le contenu de l'intervention orale.",
              },
            },
            required: ["text"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "set_proposition",
          description:
            "Figer une proposition claire pour le vote une fois qu'un consensus semble émerger.",
          parameters: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "L'énoncé exact de la proposition à voter.",
              },
            },
            required: ["text"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "manage_speech_queue",
          description: "Gérer la file d'attente des orateurs.",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["invite", "remove"],
                description: "L'action à effectuer.",
              },
              userId: {
                type: "string",
                description: "L'ID de l'utilisateur concerné.",
              },
            },
            required: ["action", "userId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "flash_poll",
          description:
            "Déclencher un vote rapide (Pour/Contre/Abstention) sur une question précise.",
          parameters: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "La question à poser aux participants.",
              },
            },
            required: ["question"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "generate_report",
          description: "Générer un Procès-Verbal (PV) de la séance actuelle.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "search_memory",
          description:
            "Rechercher des informations dans l'historique sémantique de la salle (faits, arguments, logs de modération passés).",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Le sujet ou la question à rechercher.",
              },
              include_moderation: {
                type: "boolean",
                description:
                  "Si vrai, inclut les logs de modération dans la recherche.",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "display_media",
          description:
            "Afficher un contenu multimédia (image, lien, pad, vidéo) aux participants.",
          parameters: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["image", "link", "pad", "video"],
                description: "Le type de média.",
              },
              url: {
                type: "string",
                description: "L'URL du média à afficher.",
              },
              title: {
                type: "string",
                description: "Un titre optionnel pour le média.",
              },
            },
            required: ["type", "url"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "manage_speech_queue",
          description:
            "Gérer la file d'attente des orateurs et le temps de parole. Utilise cet outil pour inviter un participant à prendre la parole, lui demander de conclure s'il dépasse son temps, ou rééquilibrer le temps de parole entre les participants.",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["invite", "warn_time", "suggest_next"],
                description: "L'action à effectuer sur la file d'attente.",
              },
              participant_id: {
                type: "string",
                description: "L'ID du participant concerné.",
              },
              reason: {
                type: "string",
                description:
                  "La justification (ex: 'Temps de parole cumulé trop élevé', 'N'a pas encore parlé').",
              },
            },
            required: ["action", "participant_id", "reason"],
          },
        },
      },
    ];

    // 2. Determine Voice
    let voice = room_settings?.ophelia?.voice || "nova";
    if (system_prompt && system_prompt.includes("VOICE:")) {
      const match = system_prompt.match(/VOICE:\s*(\w+)/);
      if (match) voice = match[1];
    }

    // 3. Call LLM (with potential internal tool execution)
    const model = room_settings?.ophelia?.model || "gpt-4o";
    const now = new Date();
    const timeContext = `\n[CONTEXTE TEMPOREL] : Nous sommes le ${now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. Il est actuellement ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`;
    const platformContext = `\n[PLATEFORME] : Tu es sur Kudocracy, un système de médiation pour assemblées délibérantes.`;
    const silentContext = is_silent
      ? "\n[MODE SILENCIEUX] : Tu es actuellement en mode texte seul. Ne génère pas de voix et privilégie les réponses écrites claires."
      : "\n[MODE VOCAL] : Tu peux utiliser la voix pour t'exprimer si nécessaire.";

    const agendaText =
      agenda && Array.isArray(agenda) && agenda.length > 0
        ? `\nORDRE DU JOUR ACTUEL :\n${agenda.map((item, i) => `${i + 1}. ${item.title || item}`).join("\n")}`
        : "";

    let currentMessages = [
      {
        role: "system",
        content:
          (system_prompt || "Tu es Ophélia, médiatrice de Kudocracy.") +
          timeContext +
          platformContext +
          silentContext +
          agendaText +
          speechStatsContext +
          roomKnowledgeContext +
          consentsContext +
          onboardingWarning +
          temperatureAnalysis,
      },
      ...messages,
    ];

    let iteration = 0;
    const maxIterations = 3;
    let finalAiMessage = null;

    while (iteration < maxIterations) {
      iteration++;
      const completion = await openai.chat.completions.create({
        model,
        messages: currentMessages,
        tools,
        tool_choice: "auto",
        temperature: 0.6,
        max_tokens: 1500,
      });

      const aiMessage = completion.choices[0].message;
      currentMessages.push(aiMessage);

      if (!aiMessage.tool_calls) {
        finalAiMessage = aiMessage;
        break;
      }

      // Execute "internal" tools (SQL, WebSearch) and continue loop
      let hasExternalTools = false;
      const internalResults = [];

      for (const toolCall of aiMessage.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        if (name === "report_to_moderation") {
          let result;
          if (!sql) {
            result = "Erreur: Accès base de données non configuré.";
          } else {
            try {
              await sql`
                INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                VALUES (${room_id}, 'SYSTÈME', ${`SIGNALEMENT MODÉRATION (${args.severity}) : ${args.reason} (Utilisateur: ${args.user_id})`}, 'moderation_log', ${JSON.stringify(
                  {
                    participant_id: args.user_id,
                    severity: args.severity,
                    reported_at: new Date().toISOString(),
                  }
                )})
              `;
              result = `Signalement enregistré pour les administrateurs.`;
            } catch (e) {
              result = `Erreur lors du signalement: ${e.message}`;
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "create_debate_map") {
          let result;
          if (!sql) {
            result = "Erreur: Accès base de données non configuré.";
          } else {
            try {
              const summary = `CARTE DU DÉBAT :\n\n✅ Consensus :\n${args.consensus
                .map((c) => `- ${c}`)
                .join("\n")}\n\n⚠️ Frictions :\n${args.frictions
                .map((f) => `- ${f}`)
                .join("\n")}\n\n❓ Questions ouvertes :\n${args.open_questions
                .map((q) => `- ${q}`)
                .join("\n")}`;

              await sql`
                INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                VALUES (${room_id}, 'Ophélia', ${summary}, 'debate_map', ${JSON.stringify(
                  {
                    consensus: args.consensus,
                    frictions: args.frictions,
                    open_questions: args.open_questions,
                    created_at: new Date().toISOString(),
                  }
                )})
              `;
              result = `Carte du débat générée et affichée dans le salon.`;
            } catch (e) {
              result = `Erreur lors de la génération de la carte: ${e.message}`;
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "search_memory") {
          let result;
          try {
            const vectorSearchUrl = new URL(
              "/api/vector-search",
              request.url
            ).toString();
            const response = await fetch(vectorSearchUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "search",
                text: args.query,
                room_id: room_id,
              }),
            });
            const data = await response.json();
            let results = data.documents || [];

            if (!args.include_moderation) {
              results = results.filter((d) => d.type !== "moderation_log");
            }

            const formatted = results
              .map((d) => `[${d.type}] ${d.name}: ${d.message}`)
              .join("\n");
            result = formatted || "Aucun souvenir pertinent trouvé.";
          } catch (e) {
            result = `Erreur de recherche mémoire: ${e.message}`;
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "sql_query") {
          let result;
          if (!sql) {
            result = "Erreur: Accès base de données non configuré.";
          } else {
            const trimmed = args.query.trim();
            if (!trimmed.toLowerCase().startsWith("select")) {
              result = "Erreur: Seules les requêtes SELECT sont autorisées.";
            } else {
              try {
                const rows = await sql.unsafe(trimmed);
                result = JSON.stringify(rows);
              } catch (e) {
                result = `Erreur SQL: ${e.message}`;
              }
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "persist_knowledge") {
          let result;
          if (!sql) {
            result = "Erreur: Accès base de données non configuré.";
          } else {
            try {
              await sql`
                INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                VALUES (${room_id}, 'Ophélia', ${args.content}, 'knowledge', ${JSON.stringify(
                  {
                    category: args.category,
                    participant_id: args.participant_id || null,
                    persisted_at: new Date().toISOString(),
                  }
                )})
              `;
              result = `Connaissance sauvegardée dans la catégorie '${args.category}'.`;
            } catch (e) {
              result = `Erreur lors de la sauvegarde : ${e.message}`;
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "forget_knowledge") {
          let result;
          if (!sql) {
            result = "Erreur: Accès base de données non configuré.";
          } else {
            try {
              const { count } = await sql`
                DELETE FROM inseme_messages 
                WHERE room_id = ${room_id} 
                AND type = 'knowledge' 
                AND metadata->>'category' = ${args.category}
                AND message ILIKE ${"%" + args.search_term + "%"}
              `;
              result = `${count} connaissance(s) supprimée(s) pour le terme '${args.search_term}'.`;
            } catch (e) {
              result = `Erreur lors de la suppression : ${e.message}`;
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "internal_monologue") {
          let result;
          if (!sql) {
            result = "Erreur: Accès base de données non configuré.";
          } else {
            try {
              await sql`
                INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                VALUES (${room_id}, 'Ophélia', ${args.thought}, 'internal_monologue', ${JSON.stringify(
                  {
                    climat_score: args.climat_score,
                    created_at: new Date().toISOString(),
                  }
                )})
              `;
              result = "Réflexion méta-cognitive enregistrée.";
            } catch (e) {
              result = `Erreur lors de l'enregistrement du monologue: ${e.message}`;
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "suggest_action") {
          let result;
          if (!sql) {
            result = "Erreur: Accès base de données non configuré.";
          } else {
            try {
              const summary = `💡 SUGGESTION : ${args.title}\n\n${args.description}`;
              await sql`
                INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                VALUES (${room_id}, 'Ophélia', ${summary}, 'action_suggestion', ${JSON.stringify(
                  {
                    title: args.title,
                    action_type: args.action_type,
                    suggested_args: args.suggested_args || {},
                    created_at: new Date().toISOString(),
                  }
                )})
              `;
              result = `Suggestion '${args.title}' envoyée à l'assemblée.`;
            } catch (e) {
              result = `Erreur lors de la suggestion: ${e.message}`;
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "manage_speech_queue") {
          let result;
          if (!sql) {
            result = "Erreur: Accès base de données non configuré.";
          } else {
            try {
              const summary = `📢 GESTION DE PAROLE : ${args.action.toUpperCase()} pour ${args.participant_id}\n\nMotif : ${args.reason}`;
              await sql`
                INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                VALUES (${room_id}, 'Ophélia', ${summary}, 'speech_management', ${JSON.stringify(
                  {
                    action: args.action,
                    participant_id: args.participant_id,
                    reason: args.reason,
                    created_at: new Date().toISOString(),
                  }
                )})
              `;
              result = `Action '${args.action}' enregistrée pour ${args.participant_id}.`;
            } catch (e) {
              result = `Erreur lors de la gestion de parole: ${e.message}`;
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "fact_check") {
          let result;
          if (!braveKey) {
            result = "Erreur: API Brave Search non configurée.";
          } else {
            try {
              const searchResult = await performWebSearch(args.claim, braveKey);
              result = `VÉRIFICATION DE FAITS :\n\nAffirmation : "${args.claim}"\n\nRésultats trouvés :\n${searchResult}\n\nConsigne : Analyse ces résultats et réponds au groupe avec une synthèse neutre et des citations précises.`;
            } catch (e) {
              result = `Erreur lors du fact-checking: ${e.message}`;
            }
          }
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else if (name === "web_search") {
          const result = await performWebSearch(args.query, {
            apiKey: braveKey,
          });
          internalResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: result,
          });
        } else {
          hasExternalTools = true;
        }
      }

      if (internalResults.length > 0) {
        currentMessages.push(...internalResults);
      }

      if (hasExternalTools || internalResults.length === 0) {
        finalAiMessage = aiMessage;
        break;
      }
    }

    const actions = [];
    if (finalAiMessage.tool_calls) {
      for (const toolCall of finalAiMessage.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        // Skip internal tools already processed (they shouldn't be here in finalAiMessage if we broke loop correctly)
        if (name === "sql_query" || name === "web_search") continue;

        if (name === "flash_poll") {
          actions.push({
            tool: "send_message",
            args: { text: `FLASH_POLL: ${args.question}` },
          });
          continue;
        }

        let vocal_payload = null;
        if (
          !is_silent &&
          ((name === "send_message" && args.with_voice) || name === "speak")
        ) {
          try {
            const mp3 = await openai.audio.speech.create({
              model: "tts-1",
              voice: voice,
              input: args.text,
            });
            const buffer = await mp3.arrayBuffer();
            const uint8 = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < uint8.length; i++) {
              binary += String.fromCharCode(uint8[i]);
            }
            const base64 = btoa(binary);
            vocal_payload = `data:audio/mp3;base64,${base64}`;
          } catch (ttsErr) {
            console.error("TTS Error:", ttsErr);
          }
        }

        actions.push({
          tool: name,
          args,
          vocal_payload,
        });
      }
    }

    return json({ actions, text: finalAiMessage.content });
  } catch (err) {
    console.error("[Ophelia] Error:", err);
    return error(err.message);
  }
});
