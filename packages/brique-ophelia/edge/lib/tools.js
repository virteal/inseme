import OpenAI from "https://esm.sh/openai@4";
import { createPrologEngine } from "../../cop-prolog/src/index.js";
import { GOVERNANCE_MODELS, toPrologFacts } from "../../../kudocracy/src/governance.js";

/**
 * packages/brique-ophelia/edge/lib/tools.js
 * Registre centralisé des outils d'Ophélia et de leurs gestionnaires.
 */

export const ALL_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Recherche des informations actualisées sur Internet.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Requête de recherche courte et précise." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "vector_search",
      description: "Recherche dans la base de connaissances locale (histoire, documents municipaux).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Question ou requête en français." },
          limit: { type: "integer", default: 5 }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "wiki_search",
      description: "Rechercher dans les pages wiki.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer", default: 5 }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sql_query",
      description: "Exécuter une requête SQL SELECT sur la base de données.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Requête SELECT uniquement." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_post",
      description: "Publie un nouveau message ou une annonce.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          title: { type: "string" },
          group_id: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_posts",
      description: "Liste les messages récents (Le Fil).",
      parameters: {
        type: "object",
        properties: {
          group_id: { type: "string" },
          limit: { type: "integer" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Crée une nouvelle tâche.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          project_id: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_wiki_page",
      description: "Crée une nouvelle page Wiki.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" }
        },
        required: ["title", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "vote_proposition",
      description: "Vote sur une proposition citoyenne.",
      parameters: {
        type: "object",
        properties: {
          proposition_id: { type: "string" },
          value: { type: "integer", enum: [1, -1, 0] }
        },
        required: ["proposition_id", "value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_context",
      description: "Récupère des infos sur l'utilisateur actuel et le contexte.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_capabilities",
      description: "Liste tous les outils disponibles pour l'agent.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "prolog_query",
      description: "Interroger le moteur de raisonnement logique ProLog sur la gouvernance.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assume_role",
      description: "Endosser un rôle spécifique.",
      parameters: {
        type: "object",
        properties: {
          role_id: { type: "string", enum: ["mediator", "analyst", "scribe", "guardian"] },
          reason: { type: "string" }
        },
        required: ["role_id", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_speech_queue",
      description: "Gérer la file d'attente des orateurs.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["invite", "warn_time", "suggest_next"] },
          participant_id: { type: "string" },
          reason: { type: "string" }
        },
        required: ["action", "participant_id", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_delegation",
      description: "Gérer les délégations de vote.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["delegate", "revoke"] },
          delegator_id: { type: "string" },
          delegate_id: { type: "string" },
          tag: { type: "string" }
        },
        required: ["action", "delegator_id", "tag"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "emit_vote_recommendation",
      description: "Émettre une recommandation de vote officielle d'Ophélia.",
      parameters: {
        type: "object",
        properties: {
          proposition_id: { type: "string" },
          recommendation: { type: "string", enum: ["pour", "contre", "abstention"] },
          rationale: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        },
        required: ["proposition_id", "recommendation", "rationale", "tags"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "persist_knowledge",
      description: "Sauvegarder une connaissance cruciale.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          category: { type: "string" }
        },
        required: ["content", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "forget_knowledge",
      description: "Supprimer une connaissance obsolète.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" },
          search_term: { type: "string" }
        },
        required: ["category", "search_term"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "report_to_moderation",
      description: "Signaler un comportement inapproprié.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          participant_id: { type: "string" }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_providers_status",
      description: "Vérifier l'état des fournisseurs d'IA.",
      parameters: { type: "object", properties: {} }
    }
  }
];

// Helper functions for vector search
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  return Math.sqrt(dot(a, a));
}
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  return dot(a, b) / (norm(a) * norm(b));
}

export function getAuthorizedTools(role) {
  return ALL_TOOLS.filter(t => 
    t.function.name === "assume_role" || 
    role.allowedTools.includes(t.function.name)
  );
}

async function performWebSearch(getConfig, query) {
  const apiKey = getConfig("BRAVE_SEARCH_API_KEY");
  if (!apiKey) return `Recherche web non configurée.`;
  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    });
    if (!response.ok) throw new Error(`Brave API: ${response.status}`);
    const data = await response.json();
    let resultText = `🔍 Résultats pour "${query}":\n\n`;
    if (data.web?.results?.length > 0) {
      data.web.results.slice(0, 5).forEach((result, i) => {
        resultText += `📄 ${i + 1}. **${result.title}**\n${result.description}\n🔗 [Source](${result.url})\n\n`;
      });
    } else {
      resultText += "Aucun résultat trouvé.";
    }
    return resultText;
  } catch (error) {
    return `Erreur de recherche: ${error.message}`;
  }
}

/**
 * Exécute un outil "interne" et retourne le résultat.
 */
export async function executeInternalTool(runtime, name, args, context = {}) {
  const { getConfig, sql, supabase: optSupabase, openai } = runtime;
  const runtimeSupabase = optSupabase || (runtime.supabase); 

  switch (name) {
    case "web_search":
      return await performWebSearch(getConfig, args.query);

    case "vector_search":
    case "wiki_search":
      if (!openai || !runtimeSupabase) return "Recherche vectorielle non disponible.";
      try {
        const embeddingRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: args.query,
        });
        const queryEmb = embeddingRes.data[0].embedding;
        let qb = runtimeSupabase.from("knowledge_chunks").select("text,embedding,metadata");
        if (name === "wiki_search") qb = qb.eq("source_type", "wiki_page");
        const { data: chunks, error: vErr } = await qb.limit(200);
        if (vErr) throw vErr;
        
        const scored = chunks.map(c => {
            let emb = c.embedding;
            if (typeof emb === 'string') emb = JSON.parse(emb);
            return {
                text: c.text,
                title: c.metadata?.title || "Document",
                score: cosineSimilarity(queryEmb, emb)
            };
        }).sort((a, b) => b.score - a.score).slice(0, args.limit || 5);

        return scored.map(s => `### ${s.title}\n${s.text}`).join("\n\n");
      } catch (e) {
        return `Erreur vectorielle: ${e.message}`;
      }

    case "sql_query":
      if (!runtimeSupabase) return "Erreur: Supabase non disponible.";
      if (!args.query.toLowerCase().trim().startsWith("select")) {
        return "Erreur: Seul SELECT est autorisé.";
      }
      try {
        const { data, error } = await runtimeSupabase.rpc("exec_sql", { sql_query: args.query });
        if (error) return `Erreur SQL RPC: ${error.message}`;
        return JSON.stringify(data);
      } catch (e) {
        return `Erreur SQL: ${e.message}`;
      }

    case "create_post":
      if (!runtimeSupabase) return "Supabase non disponible.";
      const { data: nPost, error: pErr } = await runtimeSupabase
        .from("posts")
        .insert({
          content: args.content,
          title: args.title,
          group_id: args.group_id,
          tags: args.tags
        })
        .select();
      if (pErr) return `Erreur création post: ${pErr.message}`;
      return `Post créé avec succès (ID: ${nPost[0].id})`;

    case "list_posts":
      if (!runtimeSupabase) return "Supabase non disponible.";
      const { data: posts, error: lErr } = await runtimeSupabase
        .from("posts")
        .select("id, title, content, created_at")
        .order("created_at", { ascending: false })
        .limit(args.limit || 10);
      if (lErr) return `Erreur liste posts: ${lErr.message}`;
      return JSON.stringify(posts);

    case "create_task":
        if (!runtimeSupabase) return "Supabase non disponible.";
        const { data: nTask, error: tErr } = await runtimeSupabase
          .from("tasks")
          .insert({
            title: args.title,
            description: args.description,
            project_id: args.project_id,
            priority: args.priority
          })
          .select();
        if (tErr) return `Erreur tâche: ${tErr.message}`;
        return `Tâche créée (ID: ${nTask[0].id})`;

    case "create_wiki_page":
        if (!runtimeSupabase) return "Supabase non disponible.";
        const { data: nWiki, error: wErr } = await runtimeSupabase
          .from("wiki_pages")
          .insert({
            title: args.title,
            content: args.content
          })
          .select();
        if (wErr) return `Erreur wiki: ${wErr.message}`;
        return `Page Wiki créée (ID: ${nWiki[0].id})`;

    case "vote_proposition":
      if (!runtimeSupabase) return "Supabase non disponible.";
      const { error: vPErr } = await runtimeSupabase
        .rpc("vote_proposition", { 
          p_proposition_id: args.proposition_id, 
          p_value: args.value 
        });
      if (vPErr) return `Erreur vote: ${vPErr.message}`;
      return "Vote enregistré.";

    case "get_user_context":
        return JSON.stringify({
            user: context.user || { role: "anonymous" },
            room: context.room_id || "global",
            role: context.role?.id || "default"
        });

    case "list_capabilities":
        return JSON.stringify(ALL_TOOLS.map(t => ({ name: t.function.name, description: t.function.description })));

    case "prolog_query":
        try {
          const engine = await createPrologEngine();
          const govFacts = toPrologFacts();
          const roomFacts = []; 
          const rs = context.room_settings || {};
          roomFacts.push(`current_room_model("${rs.governance_model || "agora"}").`);
          if (rs.connectedUsers) {
              rs.connectedUsers.forEach(u => {
                  const safeName = (u.name || u.id).replace(/"/g, '\\"');
                  roomFacts.push(`room_participant("${u.id}", "${safeName}", "${u.status || "online"}").`);
              });
          }
          await engine.consult([...govFacts, ...roomFacts]);
          await engine.query(args.query);
          const answers = await engine.findAllAnswers();
          return answers.length > 0 ? JSON.stringify(answers) : "Aucune déduction possible.";
        } catch (e) {
          return `Erreur Prolog: ${e.message}`;
        }

    case "manage_delegation":
        if (sql) {
            if (args.action === "delegate") {
                await sql`INSERT INTO delegations (delegator_id, delegate_id, tag_id) 
                          SELECT ${args.delegator_id}, ${args.delegate_id}, id FROM tags WHERE name = ${args.tag}
                          ON CONFLICT (delegator_id, tag_id) DO UPDATE SET delegate_id = EXCLUDED.delegate_id`;
            } else {
                await sql`DELETE FROM delegations WHERE delegator_id = ${args.delegator_id} 
                          AND tag_id IN (SELECT id FROM tags WHERE name = ${args.tag})`;
            }
        }
        return `Délégation ${args.action === "delegate" ? "créée" : "supprimée"}.`;

    case "emit_vote_recommendation":
        if (sql) {
            try {
                const tagNames = args.tags.map(t => t.toLowerCase());
                const OPHELIA_ID = getConfig("OPHELIA_ID") || "ophelia";
                const weightRow = await sql`
                  SELECT COUNT(DISTINCT delegator_id) as count
                  FROM delegations d
                  JOIN tags t ON d.tag_id = t.id
                  WHERE t.name = ANY(${tagNames})
                  AND (d.delegate_id = ${OPHELIA_ID} OR d.delegate_id = 'ophelia')
                `;
                const delegatorCount = parseInt(weightRow[0]?.count || 0);
                let summary = `Recommandation: ${args.recommendation.toUpperCase()}\n\n${args.rationale}`;
                if (delegatorCount > 0) summary += `\n\n*(Soutenue par ${delegatorCount} délégant(s))*`;
                await sql`INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                          VALUES (${context.room_id}, 'Ophélia', ${summary}, 'vote_recommendation', ${JSON.stringify({...args, delegator_count: delegatorCount})})`;
                return `Recommandation envoyée (Poids: ${delegatorCount}).`;
            } catch (e) { return `Erreur recommandation: ${e.message}`; }
        }
        return "Erreur: SQL non disponible.";

    case "persist_knowledge":
        if (sql) {
            await sql`INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                      VALUES (${context.room_id}, 'Ophélia', ${args.content}, 'knowledge', ${JSON.stringify(args)})`;
        }
        return "Connaissance sauvegardée.";

    case "report_to_moderation":
        if (sql) {
            await sql`INSERT INTO inseme_messages (room_id, name, message, type, metadata)
                      VALUES (${context.room_id}, 'SYSTÈME', ${`SIGNALEMENT: ${args.reason}`}, 'moderation_log', ${JSON.stringify(args)})`;
        }
        return "Signalement enregistré.";

    case "check_providers_status":
        const providers = ["openai", "anthropic", "mistral", "google"];
        const active = providers.filter(p => !!getConfig(`${p.toUpperCase()}_API_KEY`));
        return `Fournisseurs actifs : ${active.join(", ")}.`;

    default:
      return null;
  }
}
