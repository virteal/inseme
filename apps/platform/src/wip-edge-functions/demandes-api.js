/**
 * Demandes API - Edge Function
 *
 * API for managing administrative requests (CRPA, etc.) with:
 * - Full CRUD operations
 * - Automatic deadline creation
 * - Response tracking
 * - Implicit refusal detection
 *
 * Endpoints:
 * - GET    /demandes           - List demandes (with filters)
 * - GET    /demandes/:id       - Get single demande with responses
 * - POST   /demandes           - Create demande
 * - PUT    /demandes/:id       - Update demande
 * - POST   /demandes/:id/responses - Add response to demande
 */

import { getSupabase } from "../../common/config/instanceConfig.edge.js";

// ============================================================================
// CORS and Response Helpers
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message, status = 400, details = null) {
  const body = { error: message };
  if (details) body.details = details;
  return jsonResponse(body, status);
}

// ============================================================================
// Validation
// ============================================================================

const DEMANDE_TYPES = ["CRPA", "INFO", "RECLAMATION", "SIGNALEMENT", "AUTRE"];
const MODE_ENVOIS = ["MAIL", "LRAR", "DEPOT", "TELESERVICE", "FAX", "AUTRE"];
const DEMANDE_STATUSES = [
  "EN_ATTENTE",
  "REPONDU_PARTIEL",
  "REPONDU_COMPLET",
  "REFUS_EXPLICITE",
  "REFUS_IMPLICITE",
  "IRRECEVABLE",
  "CLOTURE",
];
const REPONSE_TYPES = [
  "ACCES_TOTAL",
  "ACCES_PARTIEL",
  "REFUS_MOTIVE",
  "SILENCE",
  "INCOMPETENCE",
  "IRRECEVABILITE",
  "AUTRE",
];

function validateDemande(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.collectivite_id) errors.push("collectivite_id is required");
    if (!data.type_demande) errors.push("type_demande is required");
    if (!data.destinataire_org) errors.push("destinataire_org is required");
    if (!data.date_envoi) errors.push("date_envoi is required");
    if (!data.objet) errors.push("objet is required");
  }

  if (data.type_demande && !DEMANDE_TYPES.includes(data.type_demande)) {
    errors.push(`type_demande must be one of: ${DEMANDE_TYPES.join(", ")}`);
  }

  if (data.mode_envoi && !MODE_ENVOIS.includes(data.mode_envoi)) {
    errors.push(`mode_envoi must be one of: ${MODE_ENVOIS.join(", ")}`);
  }

  if (data.status && !DEMANDE_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${DEMANDE_STATUSES.join(", ")}`);
  }

  return errors;
}

function validateReponse(data) {
  const errors = [];

  if (!data.date_reception) errors.push("date_reception is required");
  if (!data.type_reponse) errors.push("type_reponse is required");

  if (data.type_reponse && !REPONSE_TYPES.includes(data.type_reponse)) {
    errors.push(`type_reponse must be one of: ${REPONSE_TYPES.join(", ")}`);
  }

  return errors;
}

// ============================================================================
// Route Parser
// ============================================================================

function parseRoute(url) {
  const urlObj = new URL(url);
  const path = urlObj.pathname.replace(/^\/demandes-api\/?/, "");
  const parts = path.split("/").filter(Boolean);
  const params = Object.fromEntries(urlObj.searchParams);

  return { parts, params };
}

// ============================================================================
// Audit Logging
// ============================================================================

async function logAudit(
  supabase,
  { userId, actorType, action, entityType, entityId, payload, request }
) {
  try {
    const ip = request?.headers?.get("x-forwarded-for") || request?.headers?.get("x-real-ip");
    const userAgent = request?.headers?.get("user-agent");

    await supabase.from("civic_audit_log").insert({
      user_id: userId,
      actor_type: actorType || "HUMAIN",
      action,
      entity_type: entityType,
      entity_id: entityId,
      payload: payload || {},
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
}

// ============================================================================
// Demandes Handlers
// ============================================================================

async function listDemandes(supabase, params, user) {
  let query = supabase
    .from("demande_admin")
    .select(
      `
      *,
      collectivite:collectivite_id(id, nom_officiel),
      acte:acte_id(id, objet_court, date_acte, type_acte)
    `
    )
    .order("date_envoi", { ascending: false });

  // Apply filters
  if (params.collectivite_id) {
    query = query.eq("collectivite_id", params.collectivite_id);
  }
  if (params.type_demande) {
    query = query.eq("type_demande", params.type_demande);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.acte_id) {
    query = query.eq("acte_id", params.acte_id);
  }
  if (params.pending === "true") {
    query = query.eq("status", "EN_ATTENTE");
  }

  // Pagination
  const limit = Math.min(parseInt(params.limit) || 50, 200);
  const offset = parseInt(params.offset) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error listing demandes:", error);
    return errorResponse("Failed to fetch demandes", 500, error.message);
  }

  return jsonResponse({
    data,
    pagination: { limit, offset, total: count },
  });
}

async function getDemande(supabase, demandeId, user) {
  const { data, error } = await supabase
    .from("demande_admin")
    .select(
      `
      *,
      collectivite:collectivite_id(id, nom_officiel, code_insee),
      acte:acte_id(id, objet_court, date_acte, type_acte, numero_interne),
      created_by_user:created_by(id, display_name)
    `
    )
    .eq("id", demandeId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return errorResponse("Demande not found", 404);
    }
    return errorResponse("Failed to fetch demande", 500, error.message);
  }

  // Get responses
  const { data: reponses } = await supabase
    .from("reponse_admin")
    .select(
      `
      *,
      proof:proof_id(id, type, storage_url, original_filename, verified_by_human)
    `
    )
    .eq("demande_id", demandeId)
    .order("date_reception", { ascending: true });

  // Get deadlines
  const { data: deadlines } = await supabase
    .from("deadline_instance")
    .select(
      `
      id, start_date, due_date, status, closed_at,
      template:template_id(libelle, base_legale, action_attendue, consequence_depassement)
    `
    )
    .eq("entity_type", "DEMANDE")
    .eq("entity_id", demandeId);

  // Get linked proofs
  const { data: proofLinks } = await supabase
    .from("proof_link")
    .select(
      `
      id, role, piece_number,
      proof:proof_id(id, type, storage_url, original_filename, probative_force, verified_by_human)
    `
    )
    .eq("entity_type", "DEMANDE")
    .eq("entity_id", demandeId);

  // Get legal status
  const { data: legalStatus } = await supabase
    .from("legal_status_instance")
    .select("id, status_code, date_debut, justification")
    .eq("entity_type", "DEMANDE")
    .eq("entity_id", demandeId)
    .is("date_fin", null)
    .order("date_debut", { ascending: false })
    .limit(1);

  // Get related recours
  const { data: recours } = await supabase
    .from("recours")
    .select("id, type, status, issue, date_envoi")
    .eq("demande_id", demandeId);

  return jsonResponse({
    ...data,
    reponses: reponses || [],
    deadlines: deadlines || [],
    proofs: proofLinks || [],
    current_legal_status: legalStatus?.[0] || null,
    recours: recours || [],
  });
}

async function createDemande(supabase, data, user, request) {
  const errors = validateDemande(data);
  if (errors.length > 0) {
    return errorResponse("Validation failed", 400, errors);
  }

  // Verify collectivite exists
  const { data: collectivite, error: collectiviteError } = await supabase
    .from("collectivite")
    .select("id")
    .eq("id", data.collectivite_id)
    .single();

  if (collectiviteError || !collectivite) {
    return errorResponse("Collectivite not found", 404);
  }

  // Verify acte exists if provided
  if (data.acte_id) {
    const { data: acte, error: acteError } = await supabase
      .from("acte")
      .select("id")
      .eq("id", data.acte_id)
      .is("valid_to", null)
      .single();

    if (acteError || !acte) {
      return errorResponse("Acte not found", 404);
    }
  }

  const demandeData = {
    collectivite_id: data.collectivite_id,
    acte_id: data.acte_id || null,
    type_demande: data.type_demande,
    destinataire_org: data.destinataire_org,
    destinataire_contact: data.destinataire_contact || null,
    destinataire_email: data.destinataire_email || null,
    date_envoi: data.date_envoi,
    mode_envoi: data.mode_envoi || "MAIL",
    objet: data.objet,
    texte_envoye: data.texte_envoye || null,
    status: "EN_ATTENTE",
    reference_interne: data.reference_interne || null,
    metadata: data.metadata || { schemaVersion: 1 },
    created_by: user.id,
  };

  const { data: newDemande, error } = await supabase
    .from("demande_admin")
    .insert(demandeData)
    .select()
    .single();

  if (error) {
    console.error("Error creating demande:", error);
    return errorResponse("Failed to create demande", 500, error.message);
  }

  // Create deadlines for the new demande
  const { data: deadlineCount, error: deadlineError } = await supabase.rpc(
    "create_demande_deadlines",
    { p_demande_id: newDemande.id }
  );

  if (deadlineError) {
    console.error("Failed to create deadlines:", deadlineError);
  }

  // Audit log
  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "CREATE",
    entityType: "DEMANDE",
    entityId: newDemande.id,
    payload: {
      demande_data: demandeData,
      deadlines_created: deadlineCount || 0,
    },
    request,
  });

  return jsonResponse(newDemande, 201);
}

async function updateDemande(supabase, demandeId, data, user, request) {
  const errors = validateDemande(data, true);
  if (errors.length > 0) {
    return errorResponse("Validation failed", 400, errors);
  }

  // Check demande exists
  const { data: existingDemande, error: existingError } = await supabase
    .from("demande_admin")
    .select("id, status")
    .eq("id", demandeId)
    .single();

  if (existingError || !existingDemande) {
    return errorResponse("Demande not found", 404);
  }

  // Build update data
  const updateData = {};
  const allowedFields = [
    "type_demande",
    "destinataire_org",
    "destinataire_contact",
    "destinataire_email",
    "date_envoi",
    "mode_envoi",
    "objet",
    "texte_envoye",
    "status",
    "reference_interne",
    "reference_admin",
    "metadata",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return errorResponse("No valid fields to update", 400);
  }

  const { data: updatedDemande, error } = await supabase
    .from("demande_admin")
    .update(updateData)
    .eq("id", demandeId)
    .select()
    .single();

  if (error) {
    console.error("Error updating demande:", error);
    return errorResponse("Failed to update demande", 500, error.message);
  }

  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "UPDATE",
    entityType: "DEMANDE",
    entityId: demandeId,
    payload: {
      previous_status: existingDemande.status,
      new_status: updateData.status,
      changes: updateData,
    },
    request,
  });

  return jsonResponse(updatedDemande);
}

async function addResponse(supabase, demandeId, data, user, request) {
  const errors = validateReponse(data);
  if (errors.length > 0) {
    return errorResponse("Validation failed", 400, errors);
  }

  // Check demande exists
  const { data: demande, error: demandeError } = await supabase
    .from("demande_admin")
    .select("id, status")
    .eq("id", demandeId)
    .single();

  if (demandeError || !demande) {
    return errorResponse("Demande not found", 404);
  }

  // Create response
  const reponseData = {
    demande_id: demandeId,
    date_reception: data.date_reception,
    type_reponse: data.type_reponse,
    resume: data.resume || null,
    proof_id: data.proof_id || null,
    metadata: data.metadata || { schemaVersion: 1 },
    created_by: user.id,
  };

  const { data: newReponse, error } = await supabase
    .from("reponse_admin")
    .insert(reponseData)
    .select()
    .single();

  if (error) {
    console.error("Error creating response:", error);
    return errorResponse("Failed to create response", 500, error.message);
  }

  // Update demande status based on response type
  let newStatus = demande.status;
  switch (data.type_reponse) {
    case "ACCES_TOTAL":
      newStatus = "REPONDU_COMPLET";
      break;
    case "ACCES_PARTIEL":
      newStatus = "REPONDU_PARTIEL";
      break;
    case "REFUS_MOTIVE":
      newStatus = "REFUS_EXPLICITE";
      break;
    case "INCOMPETENCE":
    case "IRRECEVABILITE":
      newStatus = "IRRECEVABLE";
      break;
  }

  if (newStatus !== demande.status) {
    await supabase.from("demande_admin").update({ status: newStatus }).eq("id", demandeId);
  }

  // Close related deadline if exists
  const { data: deadlines } = await supabase
    .from("deadline_instance")
    .select("id")
    .eq("entity_type", "DEMANDE")
    .eq("entity_id", demandeId)
    .eq("status", "OUVERTE");

  if (deadlines && deadlines.length > 0) {
    await supabase
      .from("deadline_instance")
      .update({
        status: "RESPECTEE",
        closed_at: new Date().toISOString(),
        closed_by_user_id: user.id,
        closed_reason: `Réponse reçue: ${data.type_reponse}`,
      })
      .in(
        "id",
        deadlines.map((d) => d.id)
      );
  }

  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "CREATE",
    entityType: "DEMANDE",
    entityId: demandeId,
    payload: {
      response_id: newReponse.id,
      response_type: data.type_reponse,
      demande_status_updated: newStatus !== demande.status,
      new_status: newStatus,
    },
    request,
  });

  return jsonResponse(newReponse, 201);
}

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(request, context) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();

    // Authenticate
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Authorization required", 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return errorResponse("Invalid or expired token", 401);
    }

    // Parse route
    const { parts, params } = parseRoute(request.url);
    const method = request.method;

    // Route: /demandes
    if (parts[0] === "demandes" || parts[0] === undefined) {
      if (parts.length === 0 || (parts.length === 1 && parts[0] === "demandes")) {
        if (method === "GET") {
          return await listDemandes(supabase, params, user);
        }
        if (method === "POST") {
          const body = await request.json();
          return await createDemande(supabase, body, user, request);
        }
      }

      if (parts.length === 2 && parts[0] === "demandes") {
        const demandeId = parts[1];
        if (method === "GET") {
          return await getDemande(supabase, demandeId, user);
        }
        if (method === "PUT") {
          const body = await request.json();
          return await updateDemande(supabase, demandeId, body, user, request);
        }
      }

      if (parts.length === 3 && parts[0] === "demandes" && parts[2] === "responses") {
        const demandeId = parts[1];
        if (method === "POST") {
          const body = await request.json();
          return await addResponse(supabase, demandeId, body, user, request);
        }
      }
    }

    return errorResponse("Not Found", 404);
  } catch (error) {
    console.error("Unexpected error:", error);
    return errorResponse("Internal Server Error", 500, error.message);
  }
}
