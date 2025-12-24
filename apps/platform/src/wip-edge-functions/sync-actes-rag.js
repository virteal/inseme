// netlify/edge-functions/sync-actes-rag.js
// ============================================================================
// Edge Function: Synchronize Civic Acts to RAG Documents
// Description: Syncs modified actes to civic_rag_document table with embeddings
//              Can be called via cron or manually after acte modifications
// Version: 1.0.0
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";
import { getConfig } from "../../common/config/instanceConfig.edge.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Key",
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 10; // Process actes in batches to avoid rate limits

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(openai, text) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000), // Truncate to model limit
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("[Embedding] ❌ Error:", error.message);
    throw error;
  }
}

/**
 * Process a single acte and sync to RAG document
 */
async function syncActeToRAG(supabase, openai, acte) {
  try {
    // Generate embedding for synthetic text
    const embedding = await generateEmbedding(openai, acte.synthetic_text);

    // Check for existing current document
    const { data: existing } = await supabase
      .from("civic_rag_document")
      .select("id, version")
      .eq("source_type", "ACTE")
      .eq("source_id", acte.id)
      .eq("is_current", true)
      .single();

    // Mark existing as not current
    if (existing) {
      await supabase
        .from("civic_rag_document")
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    // Build metadata
    const metadata = {
      type_acte: acte.type_acte,
      date_acte: acte.date_acte,
      date_seance: acte.date_seance,
      collectivite_nom: acte.collectivite_nom,
      collectivite_code: acte.collectivite_code,
      statut_juridique: acte.statut_juridique,
      transmission_confirmee: acte.transmission_confirmed !== null,
      nb_demandes: acte.nb_demandes,
      nb_deadlines_depassees: acte.nb_deadlines_depassees,
      montant_eur: acte.montant_eur,
      domaine: acte.domaine,
      schemaVersion: 1,
    };

    // Extract keywords from JSONB
    let keywords = null;
    if (acte.keywords_json) {
      try {
        keywords = Array.isArray(acte.keywords_json)
          ? acte.keywords_json
          : JSON.parse(acte.keywords_json);
      } catch {
        keywords = null;
      }
    }

    // Insert new RAG document
    const title = `${acte.type_acte || "ACTE"} n°${acte.numero_interne || acte.numero_actes || "N/A"} — ${acte.objet_court || "Sans objet"}`;

    const { data: newDoc, error: insertError } = await supabase
      .from("civic_rag_document")
      .insert({
        source_type: "ACTE",
        source_id: acte.id,
        collectivite_id: acte.collectivite_id,
        title: title.substring(0, 500),
        content: acte.synthetic_text,
        summary: acte.objet_court,
        index_type: "PROBATOIRE",
        domain: acte.domaine,
        keywords,
        metadata,
        embedding,
        is_current: true,
        version: existing ? existing.version + 1 : 1,
        supersedes_id: existing?.id || null,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      acte_id: acte.id,
      rag_doc_id: newDoc.id,
      version: existing ? existing.version + 1 : 1,
      status: "synced",
    };
  } catch (error) {
    console.error(`[SyncActe] ❌ Error syncing acte ${acte.id}:`, error.message);
    return {
      acte_id: acte.id,
      rag_doc_id: null,
      version: null,
      status: "error",
      error: error.message,
    };
  }
}

/**
 * Sync demande to RAG document
 */
async function syncDemandeToRAG(supabase, openai, demande) {
  try {
    // Build synthetic text for demande
    const syntheticText = `
DEMANDE ADMINISTRATIVE — ${demande.type_demande || "CRPA"}

Référence interne : ${demande.reference_interne || "N/A"}
Date d'envoi : ${demande.date_envoi || "Non envoyée"}
Destinataire : ${demande.destinataire || "Non précisé"}

Objet : ${demande.objet || "Non renseigné"}

Statut : ${demande.status || "EN_ATTENTE"}

${demande.contenu || ""}

Acte lié : ${demande.acte_numero || "Aucun"}
Collectivité : ${demande.collectivite_nom || "Non précisée"}
`.trim();

    // Generate embedding
    const embedding = await generateEmbedding(openai, syntheticText);

    // Check for existing document
    const { data: existing } = await supabase
      .from("civic_rag_document")
      .select("id, version")
      .eq("source_type", "DEMANDE")
      .eq("source_id", demande.id)
      .eq("is_current", true)
      .single();

    if (existing) {
      await supabase
        .from("civic_rag_document")
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    const title = `${demande.type_demande || "DEMANDE"} — ${demande.objet?.substring(0, 100) || "Sans objet"}`;

    const { data: newDoc, error: insertError } = await supabase
      .from("civic_rag_document")
      .insert({
        source_type: "DEMANDE",
        source_id: demande.id,
        collectivite_id: demande.collectivite_id,
        title: title.substring(0, 500),
        content: syntheticText,
        summary: demande.objet?.substring(0, 200),
        index_type: "PROBATOIRE",
        domain: null,
        keywords: null,
        metadata: {
          type_demande: demande.type_demande,
          date_envoi: demande.date_envoi,
          status: demande.status,
          destinataire: demande.destinataire,
          schemaVersion: 1,
        },
        embedding,
        is_current: true,
        version: existing ? existing.version + 1 : 1,
        supersedes_id: existing?.id || null,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return {
      demande_id: demande.id,
      rag_doc_id: newDoc.id,
      status: "synced",
    };
  } catch (error) {
    return {
      demande_id: demande.id,
      rag_doc_id: null,
      status: "error",
      error: error.message,
    };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(request) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only accept POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Authenticate: either cron key or user auth
  const cronKey = request.headers.get("X-Cron-Key");
  const authHeader = request.headers.get("Authorization");
  const expectedCronKey = getConfig("cron_api_key");

  let isAuthenticated = false;
  let userId = null;

  if (cronKey && expectedCronKey && cronKey === expectedCronKey) {
    isAuthenticated = true;
    console.log("[SyncRAG] ✅ Authenticated via cron key");
  } else if (authHeader) {
    // Verify user auth
    const supabaseUrl = getConfig("supabase_url");
    const supabaseAnonKey = getConfig("supabase_anon_key");

    if (supabaseUrl && supabaseAnonKey) {
      const token = authHeader.replace("Bearer ", "");
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const {
        data: { user },
        error,
      } = await tempClient.auth.getUser();
      if (!error && user) {
        // Check if user has admin role
        const { data: profile } = await tempClient
          .from("civic_user_profile")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile && ["ADMIN_SYSTEM", "LEGAL_REVIEWER"].includes(profile.role)) {
          isAuthenticated = true;
          userId = user.id;
          console.log(`[SyncRAG] ✅ Authenticated as user ${user.id} with role ${profile.role}`);
        }
      }
    }
  }

  if (!isAuthenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Initialize clients (vault first, then env)
  const supabaseUrl = getConfig("supabase_url");
  const supabaseKey = getConfig("supabase_service_role_key");
  const openaiKey = getConfig("openai_api_key");

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase not configured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!openaiKey) {
    return new Response(JSON.stringify({ error: "OpenAI not configured for embeddings" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  // Parse request body
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const since = body.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const syncType = body.type || "all"; // "all", "actes", "demandes"
  const specificIds = body.ids || []; // Specific IDs to sync
  const fullResync = body.full_resync === true;

  console.log(
    `[SyncRAG] 🚀 Starting sync - type=${syncType}, since=${since}, fullResync=${fullResync}`
  );

  const results = {
    timestamp: new Date().toISOString(),
    syncType,
    since: fullResync ? "full" : since,
    actes: { synced: 0, errors: 0, details: [] },
    demandes: { synced: 0, errors: 0, details: [] },
  };

  try {
    // Sync Actes
    if (syncType === "all" || syncType === "actes") {
      // Fetch actes from synthetic view
      let query = supabase.from("v_actes_synthetiques").select("*");

      if (specificIds.length > 0) {
        query = query.in("id", specificIds);
      } else if (!fullResync) {
        query = query.gte("updated_at", since);
      }

      const { data: actes, error: actesError } = await query;

      if (actesError) {
        console.error("[SyncRAG] ❌ Error fetching actes:", actesError);
        results.actes.error = actesError.message;
      } else if (actes && actes.length > 0) {
        console.log(`[SyncRAG] 📋 Found ${actes.length} actes to sync`);

        // Process in batches
        for (let i = 0; i < actes.length; i += BATCH_SIZE) {
          const batch = actes.slice(i, i + BATCH_SIZE);

          for (const acte of batch) {
            const result = await syncActeToRAG(supabase, openai, acte);
            results.actes.details.push(result);

            if (result.status === "synced") {
              results.actes.synced++;
            } else {
              results.actes.errors++;
            }
          }

          // Small delay between batches to respect rate limits
          if (i + BATCH_SIZE < actes.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      } else {
        console.log("[SyncRAG] ℹ️ No actes to sync");
      }
    }

    // Sync Demandes
    if (syncType === "all" || syncType === "demandes") {
      // Fetch demandes with related info
      let query = supabase.from("demande_admin").select(`
          id,
          collectivite_id,
          acte_id,
          type_demande,
          reference_interne,
          destinataire,
          objet,
          contenu,
          date_envoi,
          status,
          metadata,
          created_at,
          updated_at,
          collectivite:collectivite_id(nom_officiel),
          acte:acte_id(numero_interne, objet_court)
        `);

      if (specificIds.length > 0) {
        query = query.in("id", specificIds);
      } else if (!fullResync) {
        query = query.gte("updated_at", since);
      }

      const { data: demandes, error: demandesError } = await query;

      if (demandesError) {
        console.error("[SyncRAG] ❌ Error fetching demandes:", demandesError);
        results.demandes.error = demandesError.message;
      } else if (demandes && demandes.length > 0) {
        console.log(`[SyncRAG] 📋 Found ${demandes.length} demandes to sync`);

        for (let i = 0; i < demandes.length; i += BATCH_SIZE) {
          const batch = demandes.slice(i, i + BATCH_SIZE);

          for (const demande of batch) {
            // Enrich with joined data
            demande.collectivite_nom = demande.collectivite?.nom_officiel;
            demande.acte_numero = demande.acte?.numero_interne;

            const result = await syncDemandeToRAG(supabase, openai, demande);
            results.demandes.details.push(result);

            if (result.status === "synced") {
              results.demandes.synced++;
            } else {
              results.demandes.errors++;
            }
          }

          if (i + BATCH_SIZE < demandes.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      } else {
        console.log("[SyncRAG] ℹ️ No demandes to sync");
      }
    }

    // Log to audit
    await supabase.from("civic_audit_log").insert({
      entity_type: "RAG_SYNC",
      entity_id: null,
      action: "SYNC",
      performed_by: userId,
      old_values: null,
      new_values: {
        actes_synced: results.actes.synced,
        actes_errors: results.actes.errors,
        demandes_synced: results.demandes.synced,
        demandes_errors: results.demandes.errors,
        since,
        full_resync: fullResync,
      },
      reason: body.reason || "Scheduled or manual RAG sync",
    });

    console.log(
      `[SyncRAG] ✅ Sync complete: ${results.actes.synced} actes, ${results.demandes.synced} demandes`
    );

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SyncRAG] ❌ Fatal error:", error);

    return new Response(
      JSON.stringify({
        error: "Sync failed",
        message: error.message,
        partial_results: results,
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
}

export const config = { path: "/api/civic/sync-rag" };
