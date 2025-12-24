// netlify/edge-functions/lib/civic-tools.js
// ============================================================================
// Civic Acts Tools for RAG Chatbot
// Description: Tools for searching and querying municipal acts, deadlines,
//              administrative requests, and transparency statistics
// Version: 1.0.0
// ============================================================================

/**
 * Tool definitions for civic acts system
 */
export const CIVIC_TOOLS = {
  civic_acts_search: {
    name: "civic_acts_search",
    description: `Recherche sémantique dans les actes municipaux (délibérations, arrêtés, décisions).
Utilise cet outil pour :
- Trouver des actes par thème (urbanisme, budget, personnel, etc.)
- Rechercher des actes par mots-clés (subvention, terrain, association, etc.)
- Explorer l'historique des décisions municipales
Retourne les actes les plus pertinents avec leur statut juridique.`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Requête de recherche en français. Ex: 'subventions associations sportives 2024'",
        },
        collectivite: {
          type: "string",
          description: "Nom ou code INSEE de la collectivité (optionnel). Ex: 'Corte' ou '2B096'",
        },
        type_acte: {
          type: "string",
          enum: ["DELIBERATION", "ARRETE", "DECISION", "PV", "AUTRE"],
          description: "Type d'acte à rechercher (optionnel)",
        },
        date_from: {
          type: "string",
          description: "Date de début au format YYYY-MM-DD (optionnel)",
        },
        date_to: {
          type: "string",
          description: "Date de fin au format YYYY-MM-DD (optionnel)",
        },
        limit: {
          type: "integer",
          description: "Nombre maximum de résultats (défaut: 5, max: 20)",
        },
      },
      required: ["query"],
    },
  },

  civic_acts_sql: {
    name: "civic_acts_sql",
    description: `Exécute une requête SQL en lecture seule sur les tables des actes municipaux.
Tables disponibles :
- v_actes_synthetiques : Vue complète des actes avec statut juridique et deadlines
- demande_admin : Demandes administratives (CRPA, CADA)
- deadline_instance : Échéances juridiques
- teletransmission : Transmissions préfecture
- recours : Recours (CADA, TA, gracieux)
- v_stats_transmission, v_stats_crpa, v_stats_recours : Statistiques agrégées
Utilise pour des requêtes précises (comptages, filtres complexes, agrégations).`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Requête SQL SELECT uniquement. Ex: SELECT COUNT(*) FROM v_actes_synthetiques WHERE type_acte = 'DELIBERATION'",
        },
        limit: {
          type: "integer",
          description: "Limite de résultats (défaut: 100)",
        },
        format: {
          type: "string",
          enum: ["json", "markdown"],
          description: "Format de sortie (défaut: json)",
        },
      },
      required: ["query"],
    },
  },

  civic_deadlines: {
    name: "civic_deadlines",
    description: `Récupère les échéances juridiques en cours ou dépassées.
Utile pour :
- Voir les délais de réponse CRPA en cours
- Identifier les transmissions en retard
- Lister les recours à déposer
- Alerter sur les délais imminents`,
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["OUVERTE", "IMMINENTE", "DEPASSEE", "all"],
          description: "Statut des échéances (défaut: all pour toutes)",
        },
        entity_type: {
          type: "string",
          enum: ["ACTE", "DEMANDE", "RECOURS"],
          description: "Type d'entité liée (optionnel)",
        },
        collectivite: {
          type: "string",
          description: "Filtrer par collectivité (optionnel)",
        },
        days_ahead: {
          type: "integer",
          description: "Nombre de jours pour les échéances imminentes (défaut: 7)",
        },
        limit: {
          type: "integer",
          description: "Nombre max de résultats (défaut: 10)",
        },
      },
    },
  },

  civic_transparency_score: {
    name: "civic_transparency_score",
    description: `Récupère le score de transparence et les statistiques d'une collectivité.
Inclut :
- Taux de transmission des actes à la préfecture
- Taux de réponse aux demandes CRPA
- Nombre de refus implicites (silences)
- Score global de transparence (0-100)
- Évolution par rapport aux mois précédents`,
    parameters: {
      type: "object",
      properties: {
        collectivite: {
          type: "string",
          description: "Nom ou code INSEE de la collectivité. Ex: 'Corte' ou '2B096'",
        },
        include_history: {
          type: "boolean",
          description: "Inclure l'historique des scores mensuels (défaut: false)",
        },
      },
    },
  },

  civic_legal_status: {
    name: "civic_legal_status",
    description: `Recherche le statut juridique d'un acte ou d'une demande.
Retourne :
- Statut actuel (exécutoire, annulé, suspendu, etc.)
- Historique des changements de statut
- Délais en cours et conséquences juridiques`,
    parameters: {
      type: "object",
      properties: {
        acte_numero: {
          type: "string",
          description: "Numéro de l'acte à rechercher",
        },
        acte_id: {
          type: "string",
          description: "UUID de l'acte (alternative au numéro)",
        },
        include_deadlines: {
          type: "boolean",
          description: "Inclure les échéances liées (défaut: true)",
        },
      },
    },
  },

  civic_demandes_status: {
    name: "civic_demandes_status",
    description: `Liste les demandes administratives et leur statut.
Types de demandes :
- CRPA : Demandes de communication de documents (délai 1 mois)
- CADA : Saisine de la CADA après refus
- PRADA : Demande préalable de recours administratif
Retourne le statut, les réponses reçues, et les délais.`,
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "EN_ATTENTE",
            "REPONDU_COMPLET",
            "REPONDU_PARTIEL",
            "REFUS_IMPLICITE",
            "REFUS_EXPLICITE",
            "CLOS",
            "all",
          ],
          description: "Filtrer par statut (défaut: EN_ATTENTE)",
        },
        type_demande: {
          type: "string",
          enum: ["CRPA", "CADA", "PRADA", "AUTRE"],
          description: "Type de demande (optionnel)",
        },
        collectivite: {
          type: "string",
          description: "Filtrer par collectivité (optionnel)",
        },
        limit: {
          type: "integer",
          description: "Nombre max de résultats (défaut: 10)",
        },
      },
    },
  },
};

// ============================================================================
// TOOL HANDLERS
// ============================================================================

/**
 * Cosine similarity helper
 */
function cosineSimilarity(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Preview helper for logs
 */
function previewForLog(value, max = 200) {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    return s.length > max ? s.slice(0, max) + "..." : s;
  } catch {
    return String(value).slice(0, max);
  }
}

/**
 * Handler implementations
 */
export const CIVIC_TOOL_HANDLERS = {
  /**
   * Semantic search in civic acts
   */
  async civic_acts_search(
    { query, collectivite, type_acte, date_from, date_to, limit = 5 },
    { supabase, openai }
  ) {
    console.log(`[CivicActsSearch] ➜ query="${previewForLog(query)}"`);

    if (!supabase || !openai) {
      return "⚠️ Recherche d'actes non configurée (Supabase/OpenAI manquant).";
    }

    try {
      // Generate embedding for query
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Fetch RAG documents for ACTE type
      let qb = supabase
        .from("civic_rag_document")
        .select("id, source_id, title, content, summary, metadata, embedding, domain")
        .eq("source_type", "ACTE")
        .eq("is_current", true);

      // Apply filters via metadata
      // Note: For complex filters, we filter post-fetch as JSONB queries are limited

      const { data, error } = await qb.limit(500); // Fetch more to filter

      if (error) {
        console.error("[CivicActsSearch] ❌ Error:", error);
        return `⚠️ Erreur de recherche: ${error.message}`;
      }

      if (!data || data.length === 0) {
        return "Aucun acte trouvé dans la base de connaissances. La base des actes municipaux est peut-être vide.";
      }

      // Parse embeddings and compute similarity
      let scored = data
        .map((doc) => {
          let emb = doc.embedding;
          if (typeof emb === "string") {
            try {
              emb = JSON.parse(emb);
            } catch {
              emb = emb.split(",").map(Number);
            }
          }

          // Apply filters
          const meta = doc.metadata || {};

          // Collectivite filter
          if (collectivite) {
            const matchName = meta.collectivite_nom
              ?.toLowerCase()
              .includes(collectivite.toLowerCase());
            const matchCode = meta.collectivite_code === collectivite;
            if (!matchName && !matchCode) return null;
          }

          // Type acte filter
          if (type_acte && meta.type_acte !== type_acte) return null;

          // Date filters
          if (date_from && meta.date_acte && meta.date_acte < date_from) return null;
          if (date_to && meta.date_acte && meta.date_acte > date_to) return null;

          const similarity = cosineSimilarity(queryEmbedding, emb);
          return { doc, score: similarity };
        })
        .filter(Boolean);

      // Sort by similarity
      scored.sort((a, b) => b.score - a.score);

      // Take top results
      const topResults = scored.slice(0, Math.min(limit, 20));

      if (topResults.length === 0) {
        return "Aucun acte correspondant aux critères de recherche.";
      }

      // Format results
      let result = `📋 **${topResults.length} acte(s) trouvé(s)** pour "${query}":\n\n`;

      topResults.forEach((item, i) => {
        const meta = item.doc.metadata || {};
        const score = Math.round(item.score * 100);

        result += `### ${i + 1}. ${item.doc.title}\n`;
        result += `📅 Date: ${meta.date_acte || "N/A"} | `;
        result += `📍 ${meta.collectivite_nom || "Collectivité inconnue"}\n`;
        result += `⚖️ Statut: **${meta.statut_juridique || "Non défini"}** | `;
        result += `📡 Transmission: ${meta.transmission_confirmee ? "✅ Confirmée" : "⏳ En attente"}\n`;

        if (meta.nb_deadlines_depassees > 0) {
          result += `⚠️ **${meta.nb_deadlines_depassees} délai(s) dépassé(s)**\n`;
        }

        if (item.doc.summary) {
          result += `\n> ${item.doc.summary}\n`;
        }

        result += `\n_Pertinence: ${score}%_\n\n---\n\n`;
      });

      console.log(`[CivicActsSearch] ✅ ${topResults.length} résultats`);
      return result;
    } catch (error) {
      console.error("[CivicActsSearch] ❌ Error:", error);
      return `⚠️ Erreur de recherche: ${error.message}`;
    }
  },

  /**
   * SQL query on civic tables
   */
  async civic_acts_sql({ query, limit = 100, format = "json" }, { postgres, supabase }) {
    console.log(`[CivicActsSQL] ➜ query="${previewForLog(query)}"`);

    // Validate: only SELECT allowed
    const trimmed = String(query || "").trim();
    if (!trimmed || !/^SELECT\b/i.test(trimmed)) {
      return JSON.stringify({
        status: "error",
        message: "Seules les requêtes SELECT sont autorisées.",
      });
    }

    // Validate: only allowed tables
    const allowedTables = [
      "v_actes_synthetiques",
      "v_actes_current",
      "demande_admin",
      "reponse_admin",
      "deadline_instance",
      "deadline_template",
      "teletransmission",
      "recours",
      "legal_status_instance",
      "legal_status_registry",
      "collectivite",
      "v_stats_transmission",
      "v_stats_crpa",
      "v_stats_recours",
      "v_transparence_score",
      "v_deadlines_overdue",
      "v_deadlines_upcoming",
      "civic_stats_snapshot",
    ];

    const queryLower = query.toLowerCase();
    const hasValidTable = allowedTables.some((t) => queryLower.includes(t.toLowerCase()));

    if (!hasValidTable) {
      return JSON.stringify({
        status: "error",
        message: `Tables autorisées: ${allowedTables.join(", ")}`,
      });
    }

    try {
      let results;

      if (postgres) {
        // Add LIMIT if not present
        let limitedQuery = trimmed;
        if (!/LIMIT\s+\d+/i.test(trimmed)) {
          limitedQuery = `SELECT * FROM (${trimmed.replace(/;$/, "")}) AS _sq LIMIT ${limit}`;
        }

        results = await postgres.unsafe(limitedQuery);
      } else if (supabase) {
        // Fallback to RPC if available
        return JSON.stringify({
          status: "error",
          message:
            "Connexion SQL directe non disponible. Utilisez civic_acts_search pour la recherche sémantique.",
        });
      } else {
        return JSON.stringify({
          status: "error",
          message: "Base de données non configurée.",
        });
      }

      if (!results || results.length === 0) {
        return format === "markdown"
          ? "Aucun résultat."
          : JSON.stringify({ status: "ok", rows: [], count: 0 });
      }

      if (format === "markdown") {
        const columns = Object.keys(results[0]);
        let table = `| ${columns.join(" | ")} |\n`;
        table += `| ${columns.map(() => "---").join(" | ")} |\n`;
        results.forEach((row) => {
          table += `| ${columns.map((c) => String(row[c] ?? "")).join(" | ")} |\n`;
        });
        return `📊 **${results.length} résultat(s)**:\n\n${table}`;
      }

      return JSON.stringify(
        {
          status: "ok",
          rows: results,
          count: results.length,
        },
        null,
        2
      );
    } catch (error) {
      console.error("[CivicActsSQL] ❌ Error:", error);
      return JSON.stringify({
        status: "error",
        message: error.message,
      });
    }
  },

  /**
   * Get deadlines status
   */
  async civic_deadlines(
    { status = "all", entity_type, collectivite, days_ahead = 7, limit = 10 },
    { supabase }
  ) {
    console.log(`[CivicDeadlines] ➜ status=${status}, entity_type=${entity_type}`);

    if (!supabase) {
      return "⚠️ Base de données non configurée.";
    }

    try {
      let qb = supabase
        .from("deadline_instance")
        .select(
          `
          id,
          entity_type,
          entity_id,
          status,
          due_date,
          days_remaining,
          consequence_if_missed,
          template:deadline_template_id(code, label_fr)
        `
        )
        .order("due_date", { ascending: true })
        .limit(limit);

      // Status filter
      if (status !== "all") {
        if (status === "IMMINENTE") {
          // Within X days
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + days_ahead);
          qb = qb.eq("status", "OUVERTE").lte("due_date", futureDate.toISOString().split("T")[0]);
        } else {
          qb = qb.eq("status", status);
        }
      }

      if (entity_type) {
        qb = qb.eq("entity_type", entity_type);
      }

      const { data, error } = await qb;

      if (error) {
        return `⚠️ Erreur: ${error.message}`;
      }

      if (!data || data.length === 0) {
        return "✅ Aucune échéance correspondante.";
      }

      // Format output
      let result = `⏰ **${data.length} échéance(s)**:\n\n`;

      data.forEach((d, i) => {
        const dueDate = new Date(d.due_date);
        const now = new Date();
        const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        const statusEmoji = d.status === "DEPASSEE" ? "🔴" : daysLeft <= 3 ? "🟡" : "🟢";

        result += `${statusEmoji} **${d.template?.label_fr || d.template?.code || "Échéance"}**\n`;
        result += `   📅 Échéance: ${d.due_date} (${daysLeft >= 0 ? `J-${daysLeft}` : `J+${Math.abs(daysLeft)}`})\n`;
        result += `   📁 Type: ${d.entity_type}\n`;

        if (d.consequence_if_missed) {
          result += `   ⚠️ Conséquence: ${d.consequence_if_missed}\n`;
        }

        result += "\n";
      });

      return result;
    } catch (error) {
      console.error("[CivicDeadlines] ❌ Error:", error);
      return `⚠️ Erreur: ${error.message}`;
    }
  },

  /**
   * Get transparency score
   */
  async civic_transparency_score({ collectivite, include_history = false }, { supabase }) {
    console.log(`[CivicTransparency] ➜ collectivite=${collectivite}`);

    if (!supabase) {
      return "⚠️ Base de données non configurée.";
    }

    try {
      // Get current score
      let qb = supabase.from("v_transparence_score").select("*");

      if (collectivite) {
        qb = qb.or(`collectivite.ilike.%${collectivite}%,collectivite_id.eq.${collectivite}`);
      }

      const { data: scores, error } = await qb;

      if (error) {
        return `⚠️ Erreur: ${error.message}`;
      }

      if (!scores || scores.length === 0) {
        return "Aucune donnée de transparence disponible.";
      }

      let result = "";

      for (const score of scores) {
        result += `## 🏛️ ${score.collectivite}\n\n`;
        result += `### Score Global: **${score.score_global || 0}/100**\n\n`;

        result += `| Indicateur | Score | Détail |\n`;
        result += `|------------|-------|--------|\n`;
        result += `| 📡 Transmission actes | ${score.score_transmission || 0}% | ${score.total_actes || 0} actes |\n`;
        result += `| 📩 Réponse CRPA | ${score.score_reponse_crpa || 0}% | ${score.total_demandes || 0} demandes |\n`;
        result += `| 🤫 Non-silence | ${score.score_non_silence || 0}% | Pénalité refus implicites |\n`;
        result += `| ⚖️ Recours | ${score.total_recours || 0} | En cours ou terminés |\n`;

        result += "\n";

        // History if requested
        if (include_history) {
          const { data: history } = await supabase
            .from("civic_stats_snapshot")
            .select("snapshot_date, score_transparence, taux_transmission, taux_reponse")
            .eq("collectivite_id", score.collectivite_id)
            .eq("snapshot_type", "MONTHLY")
            .order("snapshot_date", { ascending: false })
            .limit(6);

          if (history && history.length > 0) {
            result += `### 📈 Évolution (6 derniers mois)\n\n`;
            result += `| Mois | Score | Transmission | Réponse CRPA |\n`;
            result += `|------|-------|--------------|---------------|\n`;
            history.forEach((h) => {
              result += `| ${h.snapshot_date} | ${h.score_transparence || "-"} | ${h.taux_transmission || "-"}% | ${h.taux_reponse || "-"}% |\n`;
            });
            result += "\n";
          }
        }
      }

      return result;
    } catch (error) {
      console.error("[CivicTransparency] ❌ Error:", error);
      return `⚠️ Erreur: ${error.message}`;
    }
  },

  /**
   * Get legal status of an act
   */
  async civic_legal_status({ acte_numero, acte_id, include_deadlines = true }, { supabase }) {
    console.log(`[CivicLegalStatus] ➜ numero=${acte_numero}, id=${acte_id}`);

    if (!supabase) {
      return "⚠️ Base de données non configurée.";
    }

    try {
      // Find the acte
      let qb = supabase.from("v_actes_synthetiques").select("*");

      if (acte_id) {
        qb = qb.eq("id", acte_id);
      } else if (acte_numero) {
        qb = qb.or(`numero_interne.ilike.%${acte_numero}%,numero_actes.ilike.%${acte_numero}%`);
      } else {
        return "⚠️ Veuillez fournir un numéro ou ID d'acte.";
      }

      const { data: actes, error } = await qb.limit(1);

      if (error) {
        return `⚠️ Erreur: ${error.message}`;
      }

      if (!actes || actes.length === 0) {
        return `Acte non trouvé: ${acte_numero || acte_id}`;
      }

      const acte = actes[0];

      let result = `## ⚖️ Statut juridique: ${acte.type_acte || "ACTE"} n°${acte.numero_interne || acte.numero_actes || "N/A"}\n\n`;
      result += `**Objet:** ${acte.objet_complet || acte.objet_court || "Non renseigné"}\n\n`;

      result += `### Statut actuel\n`;
      result += `- **Statut juridique:** ${acte.statut_juridique || "NON_DEFINI"}\n`;
      result += `- **Depuis:** ${acte.statut_depuis || "N/A"}\n`;
      result += `- **Exécutoire:** ${acte.exec_confirmed ? "✅ Confirmé" : acte.exec_declared ? "⏳ Déclaré" : "❌ Non"}\n`;

      result += `\n### Transmission préfecture\n`;
      result += `- **Transmis:** ${acte.transmission_confirmed ? `✅ Confirmé le ${acte.transmission_confirmed}` : acte.transmission_declared ? `⏳ Déclaré le ${acte.transmission_declared}` : "❌ Non transmis"}\n`;
      result += `- **Numéro @CTES:** ${acte.numero_ctes || "N/A"}\n`;
      result += `- **Statut technique:** ${acte.transmission_statut || "N/A"}\n`;

      if (include_deadlines) {
        // Get related deadlines
        const { data: deadlines } = await supabase
          .from("deadline_instance")
          .select("*, template:deadline_template_id(code, label_fr)")
          .eq("entity_type", "ACTE")
          .eq("entity_id", acte.id)
          .order("due_date");

        if (deadlines && deadlines.length > 0) {
          result += `\n### Échéances (${deadlines.length})\n`;
          deadlines.forEach((d) => {
            const emoji = d.status === "DEPASSEE" ? "🔴" : d.status === "RESPECTEE" ? "✅" : "⏳";
            result += `${emoji} ${d.template?.label_fr || d.template?.code}: ${d.due_date} (${d.status})\n`;
          });
        }

        // Get related demandes
        if (acte.nb_demandes > 0) {
          const { data: demandes } = await supabase
            .from("demande_admin")
            .select("type_demande, status, date_envoi, objet")
            .eq("acte_id", acte.id)
            .limit(5);

          if (demandes && demandes.length > 0) {
            result += `\n### Demandes liées (${acte.nb_demandes})\n`;
            demandes.forEach((d) => {
              const emoji =
                d.status === "EN_ATTENTE" ? "⏳" : d.status === "REPONDU_COMPLET" ? "✅" : "⚠️";
              result += `${emoji} ${d.type_demande}: ${d.objet?.substring(0, 50) || "Sans objet"} (${d.status})\n`;
            });
          }
        }
      }

      return result;
    } catch (error) {
      console.error("[CivicLegalStatus] ❌ Error:", error);
      return `⚠️ Erreur: ${error.message}`;
    }
  },

  /**
   * Get administrative requests status
   */
  async civic_demandes_status(
    { status = "EN_ATTENTE", type_demande, collectivite, limit = 10 },
    { supabase }
  ) {
    console.log(`[CivicDemandesStatus] ➜ status=${status}, type=${type_demande}`);

    if (!supabase) {
      return "⚠️ Base de données non configurée.";
    }

    try {
      let qb = supabase
        .from("demande_admin")
        .select(
          `
          id,
          type_demande,
          reference_interne,
          objet,
          destinataire,
          date_envoi,
          status,
          collectivite:collectivite_id(nom_officiel),
          acte:acte_id(numero_interne, objet_court)
        `
        )
        .order("date_envoi", { ascending: false })
        .limit(limit);

      if (status !== "all") {
        qb = qb.eq("status", status);
      }

      if (type_demande) {
        qb = qb.eq("type_demande", type_demande);
      }

      const { data, error } = await qb;

      if (error) {
        return `⚠️ Erreur: ${error.message}`;
      }

      if (!data || data.length === 0) {
        return `✅ Aucune demande avec statut "${status}".`;
      }

      let result = `📩 **${data.length} demande(s)** (statut: ${status}):\n\n`;

      data.forEach((d, i) => {
        const statusEmoji =
          {
            EN_ATTENTE: "⏳",
            REPONDU_COMPLET: "✅",
            REPONDU_PARTIEL: "🟡",
            REFUS_IMPLICITE: "🔴",
            REFUS_EXPLICITE: "❌",
            CLOS: "📁",
          }[d.status] || "❓";

        result += `### ${i + 1}. ${d.type_demande || "DEMANDE"} — ${d.reference_interne || "N/A"}\n`;
        result += `${statusEmoji} **Statut:** ${d.status}\n`;
        result += `📅 Envoi: ${d.date_envoi || "Non envoyée"}\n`;
        result += `🏢 Destinataire: ${d.destinataire || "Non précisé"}\n`;
        result += `📄 Objet: ${d.objet?.substring(0, 100) || "Non renseigné"}\n`;

        if (d.acte) {
          result += `🔗 Acte lié: ${d.acte.numero_interne} — ${d.acte.objet_court?.substring(0, 50)}\n`;
        }

        result += "\n";
      });

      return result;
    } catch (error) {
      console.error("[CivicDemandesStatus] ❌ Error:", error);
      return `⚠️ Erreur: ${error.message}`;
    }
  },
};

/**
 * Merge civic tools into existing tools object
 */
export function mergeCivicTools(existingTools) {
  return { ...existingTools, ...CIVIC_TOOLS };
}

/**
 * Merge civic handlers into existing handlers object
 */
export function mergeCivicHandlers(existingHandlers) {
  return { ...existingHandlers, ...CIVIC_TOOL_HANDLERS };
}
