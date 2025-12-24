/**
 * Civic Acts API - Edge Function
 *
 * Unified API for managing municipal acts with:
 * - Full CRUD operations
 * - Strict versioning (no destructive updates)
 * - Automatic deadline creation
 * - Proof management
 * - Comprehensive audit logging
 *
 * Endpoints:
 * - GET    /actes           - List actes (with filters)
 * - GET    /actes/:id       - Get single acte
 * - GET    /actes/:id/history - Get acte version history
 * - POST   /actes           - Create acte
 * - PUT    /actes/:id       - Update acte (creates new version)
 * - DELETE /actes/:id       - Soft delete (marks as abrogated)
 *
 * - GET    /proofs          - List proofs
 * - POST   /proofs          - Create proof
 * - POST   /proofs/:id/verify - Verify proof
 * - POST   /proof-links     - Link proof to entity
 */

import { getConfig, newSupabase } from "../../common/config/instanceConfig.edge.js";
import { isAdmin as permIsAdmin, getUserRole } from "./lib/permissions.js";

// ============================================================================
// CORS and Request Handling
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
// Validation Schemas (lightweight, no external deps)
// ============================================================================

const ACTE_TYPES = [
  "DEL",
  "ARR",
  "BUD",
  "MAR",
  "URB",
  "RH",
  "PATRIMONIAL",
  "CONVENTION",
  "SUBVENTION",
  "AUTRE",
];
const PROOF_TYPES = [
  "ACTE_PDF",
  "AR_CTES",
  "AR_LRAR",
  "REPONSE_MAIRIE",
  "AVIS_CADA",
  "JUGEMENT_TA",
  "JUGEMENT_CE",
  "EMAIL",
  "CAPTURE_WEB",
  "TELERECEPISSE",
  "AUTRE",
];
const SOURCE_ORGS = ["MAIRIE", "PREFECTURE", "CADA", "TA", "CE", "CITOYEN", "PRESSE", "AUTRE"];
const PROBATIVE_FORCES = ["FAIBLE", "MOYENNE", "FORTE", "JURIDICTIONNELLE"];
const ENTITY_TYPES = ["ACTE", "DEMANDE", "RECOURS", "PUBLICATION", "TELETRANSMISSION"];
const PROOF_ROLES = [
  "PIECE_PRINCIPALE",
  "ANNEXE",
  "ACCUSE_RECEPTION",
  "JUSTIFICATIF",
  "REFUTATION",
  "CONTEXTE",
];

function validateActe(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.collectivite_id) errors.push("collectivite_id is required");
    if (!data.type_acte) errors.push("type_acte is required");
    if (!data.objet_court) errors.push("objet_court is required");
    if (!data.date_acte) errors.push("date_acte is required");
  }

  if (data.type_acte && !ACTE_TYPES.includes(data.type_acte)) {
    errors.push(`type_acte must be one of: ${ACTE_TYPES.join(", ")}`);
  }

  if (data.objet_court && data.objet_court.length > 500) {
    errors.push("objet_court must be 500 characters or less");
  }

  if (data.date_acte) {
    const dateActe = new Date(data.date_acte);
    if (isNaN(dateActe.getTime())) {
      errors.push("date_acte must be a valid date");
    }
  }

  if (data.date_seance) {
    const dateSeance = new Date(data.date_seance);
    const dateActe = new Date(data.date_acte);
    if (isNaN(dateSeance.getTime())) {
      errors.push("date_seance must be a valid date");
    } else if (dateActe && dateSeance > dateActe) {
      errors.push("date_seance must be on or before date_acte");
    }
  }

  return errors;
}

function validateProof(data) {
  const errors = [];

  if (!data.type) errors.push("type is required");
  if (!data.source_org) errors.push("source_org is required");
  if (!data.hash_sha256) errors.push("hash_sha256 is required");
  if (!data.storage_url) errors.push("storage_url is required");

  if (data.type && !PROOF_TYPES.includes(data.type)) {
    errors.push(`type must be one of: ${PROOF_TYPES.join(", ")}`);
  }

  if (data.source_org && !SOURCE_ORGS.includes(data.source_org)) {
    errors.push(`source_org must be one of: ${SOURCE_ORGS.join(", ")}`);
  }

  if (data.probative_force && !PROBATIVE_FORCES.includes(data.probative_force)) {
    errors.push(`probative_force must be one of: ${PROBATIVE_FORCES.join(", ")}`);
  }

  if (data.hash_sha256 && data.hash_sha256.length !== 64) {
    errors.push("hash_sha256 must be 64 characters (SHA-256 hex)");
  }

  return errors;
}

function validateProofLink(data) {
  const errors = [];

  if (!data.proof_id) errors.push("proof_id is required");
  if (!data.entity_type) errors.push("entity_type is required");
  if (!data.entity_id) errors.push("entity_id is required");

  if (data.entity_type && !ENTITY_TYPES.includes(data.entity_type)) {
    errors.push(`entity_type must be one of: ${ENTITY_TYPES.join(", ")}`);
  }

  if (data.role && !PROOF_ROLES.includes(data.role)) {
    errors.push(`role must be one of: ${PROOF_ROLES.join(", ")}`);
  }

  return errors;
}

// ============================================================================
// Route Parser
// ============================================================================

function parseRoute(url) {
  const urlObj = new URL(url);
  const path = urlObj.pathname.replace(/^\/actes-api\/?/, "");
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
// Actes Handlers
// ============================================================================

async function listActes(supabase, params, user) {
  let query = supabase
    .from("acte")
    .select(
      `
      *,
      collectivite:collectivite_id(id, nom_officiel, code_insee),
      teletransmission(id, date_declared, date_confirmed, statut_technique)
    `
    )
    .is("valid_to", null) // Only current versions
    .order("date_acte", { ascending: false });

  // Apply filters
  if (params.collectivite_id) {
    query = query.eq("collectivite_id", params.collectivite_id);
  }
  if (params.type_acte) {
    query = query.eq("type_acte", params.type_acte);
  }
  if (params.date_from) {
    query = query.gte("date_acte", params.date_from);
  }
  if (params.date_to) {
    query = query.lte("date_acte", params.date_to);
  }
  if (params.search) {
    query = query.or(
      `objet_court.ilike.%${params.search}%,numero_interne.ilike.%${params.search}%`
    );
  }

  // Pagination
  const limit = Math.min(parseInt(params.limit) || 50, 200);
  const offset = parseInt(params.offset) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error listing actes:", error);
    return errorResponse("Failed to fetch actes", 500, error.message);
  }

  return jsonResponse({
    data,
    pagination: {
      limit,
      offset,
      total: count,
    },
  });
}

async function getActe(supabase, acteId, user) {
  const { data, error } = await supabase
    .from("acte")
    .select(
      `
      *,
      collectivite:collectivite_id(id, nom_officiel, code_insee, site_web),
      teletransmission(id, date_declared, date_confirmed, statut_technique, numero_ctes),
      created_by_user:created_by(id, display_name)
    `
    )
    .eq("id", acteId)
    .is("valid_to", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return errorResponse("Acte not found", 404);
    }
    return errorResponse("Failed to fetch acte", 500, error.message);
  }

  // Get linked proofs
  const { data: proofLinks } = await supabase
    .from("proof_link")
    .select(
      `
      id, role, piece_number,
      proof:proof_id(
        id, type, source_org, date_emission, date_reception,
        probative_force, verified_by_human, storage_url, original_filename
      )
    `
    )
    .eq("entity_type", "ACTE")
    .eq("entity_id", acteId);

  // Get deadlines
  const { data: deadlines } = await supabase
    .from("deadline_instance")
    .select(
      `
      id, start_date, due_date, status, closed_at,
      template:template_id(libelle, base_legale, action_attendue)
    `
    )
    .eq("entity_type", "ACTE")
    .eq("entity_id", acteId);

  // Get current legal status
  const { data: legalStatus } = await supabase
    .from("legal_status_instance")
    .select(
      `
      id, status_code, date_debut, date_fin, justification
    `
    )
    .eq("entity_type", "ACTE")
    .eq("entity_id", acteId)
    .is("date_fin", null)
    .order("date_debut", { ascending: false })
    .limit(1);

  // Get linked demandes
  const { data: demandes } = await supabase
    .from("demande_admin")
    .select("id, type_demande, date_envoi, status, objet")
    .eq("acte_id", acteId)
    .order("date_envoi", { ascending: false });

  return jsonResponse({
    ...data,
    proofs: proofLinks || [],
    deadlines: deadlines || [],
    current_legal_status: legalStatus?.[0] || null,
    demandes: demandes || [],
  });
}

async function getActeHistory(supabase, acteId, user) {
  // First get the current version
  const { data: currentActe, error: currentError } = await supabase
    .from("acte")
    .select("id, version, valid_from, supersedes_id")
    .eq("id", acteId)
    .single();

  if (currentError) {
    return errorResponse("Acte not found", 404);
  }

  // Trace back through all versions
  const versions = [currentActe];
  let currentId = currentActe.supersedes_id;

  while (currentId) {
    const { data: prevActe } = await supabase
      .from("acte")
      .select("id, version, valid_from, valid_to, supersedes_id, objet_court, type_acte")
      .eq("id", currentId)
      .single();

    if (!prevActe) break;
    versions.push(prevActe);
    currentId = prevActe.supersedes_id;
  }

  return jsonResponse({
    acte_id: acteId,
    current_version: currentActe.version,
    versions: versions.reverse(), // Oldest first
  });
}

async function createActe(supabase, data, user, request) {
  const errors = validateActe(data);
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

  // Prepare acte data
  const acteData = {
    collectivite_id: data.collectivite_id,
    type_acte: data.type_acte,
    numero_interne: data.numero_interne || null,
    numero_actes: data.numero_actes || null,
    objet_court: data.objet_court,
    objet_complet: data.objet_complet || null,
    date_acte: data.date_acte,
    date_seance: data.date_seance || null,
    organe: data.organe || null,
    rapporteur: data.rapporteur || null,
    exec_declared: data.exec_declared || false,
    exec_declared_date: data.exec_declared_date || null,
    exec_confirmed: false,
    metadata: data.metadata || { schemaVersion: 1 },
    created_by: user.id,
  };

  const { data: newActe, error } = await supabase.from("acte").insert(acteData).select().single();

  if (error) {
    console.error("Error creating acte:", error);
    return errorResponse("Failed to create acte", 500, error.message);
  }

  // Create deadlines for the new acte
  const { data: deadlineCount, error: deadlineError } = await supabase.rpc(
    "create_acte_deadlines",
    { p_acte_id: newActe.id }
  );

  if (deadlineError) {
    console.error("Failed to create deadlines:", deadlineError);
    // Don't fail the request, just log
  }

  // Audit log
  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "CREATE",
    entityType: "ACTE",
    entityId: newActe.id,
    payload: {
      acte_data: acteData,
      deadlines_created: deadlineCount || 0,
    },
    request,
  });

  return jsonResponse(newActe, 201);
}

async function updateActe(supabase, acteId, data, user, request) {
  const errors = validateActe(data, true);
  if (errors.length > 0) {
    return errorResponse("Validation failed", 400, errors);
  }

  // Check if acte exists and is current
  const { data: existingActe, error: existingError } = await supabase
    .from("acte")
    .select("id, version")
    .eq("id", acteId)
    .is("valid_to", null)
    .single();

  if (existingError || !existingActe) {
    return errorResponse("Acte not found or already superseded", 404);
  }

  // Build payload for versioning function
  const payload = {};
  const allowedFields = [
    "type_acte",
    "numero_interne",
    "numero_actes",
    "objet_court",
    "objet_complet",
    "date_acte",
    "date_seance",
    "organe",
    "rapporteur",
    "exec_declared",
    "exec_declared_date",
    "exec_confirmed",
    "exec_confirmed_date",
    "exec_proof_id",
    "metadata",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      payload[field] = data[field];
    }
  }

  if (Object.keys(payload).length === 0) {
    return errorResponse("No valid fields to update", 400);
  }

  // Call versioning function
  const { data: newActeId, error: versionError } = await supabase.rpc("update_acte_versioned", {
    p_acte_id: acteId,
    p_payload: payload,
    p_user_id: user.id,
  });

  if (versionError) {
    console.error("Error updating acte:", versionError);
    return errorResponse("Failed to update acte", 500, versionError.message);
  }

  // Fetch the new version
  const { data: updatedActe } = await supabase
    .from("acte")
    .select("*")
    .eq("id", newActeId)
    .single();

  return jsonResponse({
    ...updatedActe,
    _previous_version_id: acteId,
    _message: "New version created. Previous version preserved in history.",
  });
}

async function deleteActe(supabase, acteId, user, request) {
  // Soft delete: mark as abrogated via legal status
  const { data: existingActe, error: existingError } = await supabase
    .from("acte")
    .select("id")
    .eq("id", acteId)
    .is("valid_to", null)
    .single();

  if (existingError || !existingActe) {
    return errorResponse("Acte not found", 404);
  }

  // Add ABROGE legal status
  const { data: status, error: statusError } = await supabase
    .from("legal_status_instance")
    .insert({
      entity_type: "ACTE",
      entity_id: acteId,
      status_code: "ABROGE",
      date_debut: new Date().toISOString().split("T")[0],
      justification: "Acte abrogé via l'interface de gestion",
      created_by_user_id: user.id,
      created_by_actor_type: "HUMAIN",
    })
    .select()
    .single();

  if (statusError) {
    console.error("Error marking acte as abrogated:", statusError);
    return errorResponse("Failed to delete acte", 500, statusError.message);
  }

  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "DELETE",
    entityType: "ACTE",
    entityId: acteId,
    payload: { legal_status_id: status.id },
    request,
  });

  return jsonResponse({
    message: "Acte marked as abrogated",
    legal_status_id: status.id,
  });
}

// ============================================================================
// Proofs Handlers
// ============================================================================

async function listProofs(supabase, params, user) {
  let query = supabase.from("proof").select("*").order("created_at", { ascending: false });

  if (params.type) {
    query = query.eq("type", params.type);
  }
  if (params.source_org) {
    query = query.eq("source_org", params.source_org);
  }
  if (params.verified === "true") {
    query = query.eq("verified_by_human", true);
  } else if (params.verified === "false") {
    query = query.eq("verified_by_human", false);
  }

  const limit = Math.min(parseInt(params.limit) || 50, 200);
  const offset = parseInt(params.offset) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    return errorResponse("Failed to fetch proofs", 500, error.message);
  }

  return jsonResponse({ data });
}

async function createProof(supabase, data, user, request) {
  const errors = validateProof(data);
  if (errors.length > 0) {
    return errorResponse("Validation failed", 400, errors);
  }

  const proofData = {
    type: data.type,
    source_org: data.source_org,
    date_emission: data.date_emission || null,
    date_reception: data.date_reception || null,
    hash_sha256: data.hash_sha256,
    storage_url: data.storage_url,
    original_filename: data.original_filename || null,
    file_size_bytes: data.file_size_bytes || null,
    mime_type: data.mime_type || null,
    probative_force: data.probative_force || "FAIBLE",
    metadata: data.metadata || { schemaVersion: 1 },
    created_by: user.id,
  };

  const { data: newProof, error } = await supabase
    .from("proof")
    .insert(proofData)
    .select()
    .single();

  if (error) {
    console.error("Error creating proof:", error);
    return errorResponse("Failed to create proof", 500, error.message);
  }

  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "CREATE",
    entityType: "ACTE", // Use closest entity type for audit
    entityId: newProof.id,
    payload: { proof_type: data.type, source_org: data.source_org },
    request,
  });

  return jsonResponse(newProof, 201);
}

async function listProofLinks(supabase, params, user) {
  try {
    let query = supabase
      .from("proof_link")
      .select(
        `
      id, role, piece_number, created_at,
      proof:proof_id(
        id, type, source_org, date_emission, date_reception,
        probative_force, verified_by_human, storage_url, original_filename, created_at
      )
    `
      )
      .order("created_at", { ascending: false });

    if (params.acte_id || params.entity_id) {
      const acteId = params.acte_id || params.entity_id;
      query = query.eq("entity_type", "ACTE").eq("entity_id", acteId);
    }
    if (params.demande_admin_id) {
      query = query.eq("entity_type", "DEMANDE").eq("entity_id", params.demande_admin_id);
    }

    const { data, error } = await query;
    if (error) return errorResponse("Failed to fetch proof links", 500, error.message);
    return jsonResponse(data);
  } catch (err) {
    return errorResponse("Failed to fetch proof links", 500, err.message);
  }
}

async function deleteProof(supabase, proofId, user, request) {
  // Only allow admins (use shared permission helper)
  const allowed = permIsAdmin(user);
  if (!allowed) return errorResponse("Forbidden", 403);

  // Delete links first
  const { error: linkError } = await supabase.from("proof_link").delete().eq("proof_id", proofId);
  if (linkError) {
    console.error("Error deleting proof links:", linkError);
    return errorResponse("Failed to delete proof links", 500, linkError.message);
  }

  // Delete proof record
  const { data: deleted, error } = await supabase
    .from("proof")
    .delete()
    .eq("id", proofId)
    .select()
    .single();
  if (error) {
    console.error("Error deleting proof:", error);
    return errorResponse("Failed to delete proof", 500, error.message);
  }

  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "DELETE",
    entityType: "PROOF",
    entityId: proofId,
    payload: {},
    request,
  });

  return jsonResponse({ message: "deleted", proof: deleted });
}

async function verifyProof(supabase, proofId, data, user, request) {
  const { data: existingProof, error: existingError } = await supabase
    .from("proof")
    .select("id, verified_by_human")
    .eq("id", proofId)
    .single();

  if (existingError || !existingProof) {
    return errorResponse("Proof not found", 404);
  }

  if (existingProof.verified_by_human) {
    return errorResponse("Proof already verified", 400);
  }

  const { data: updatedProof, error } = await supabase
    .from("proof")
    .update({
      verified_by_human: true,
      verified_by_user_id: user.id,
      verified_at: new Date().toISOString(),
      verification_notes: data?.notes || null,
    })
    .eq("id", proofId)
    .select()
    .single();

  if (error) {
    return errorResponse("Failed to verify proof", 500, error.message);
  }

  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "VERIFY",
    entityType: "ACTE",
    entityId: proofId,
    payload: { notes: data?.notes },
    request,
  });

  return jsonResponse(updatedProof);
}

async function createProofLink(supabase, data, user, request) {
  const errors = validateProofLink(data);
  if (errors.length > 0) {
    return errorResponse("Validation failed", 400, errors);
  }

  const linkData = {
    proof_id: data.proof_id,
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    role: data.role || "PIECE_PRINCIPALE",
    piece_number: data.piece_number || null,
    metadata: data.metadata || { schemaVersion: 1 },
  };

  const { data: newLink, error } = await supabase
    .from("proof_link")
    .insert(linkData)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique violation
      return errorResponse("This proof is already linked to this entity with this role", 409);
    }
    console.error("Error creating proof link:", error);
    return errorResponse("Failed to create proof link", 500, error.message);
  }

  await logAudit(supabase, {
    userId: user.id,
    actorType: "HUMAIN",
    action: "CREATE",
    entityType: data.entity_type,
    entityId: data.entity_id,
    payload: { proof_id: data.proof_id, role: data.role },
    request,
  });

  return jsonResponse(newLink, 201);
}

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(request, context) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = newSupabase();

    // Authenticate user
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

    // Check user has civic profile (and get role)
    let { data: profile } = await supabase
      .from("civic_user_profile")
      .select("role, collectivite_id")
      .eq("id", user.id)
      .single();

    // If no profile, create default one and re-read
    if (!profile) {
      const { data: created } = await supabase
        .from("civic_user_profile")
        .insert({
          id: user.id,
          display_name: user.email?.split("@")[0] || "User",
          role: "CITIZEN_REVIEWER",
          organisation: "CITOYEN",
        })
        .select()
        .single();
      profile = created || null;
    }

    // Merge user and profile for permission helpers
    const mergedUser = { ...user, profile };

    // Parse route
    const { parts, params } = parseRoute(request.url);
    const method = request.method;

    // Route: /actes
    if (parts[0] === "actes" || parts[0] === undefined) {
      if (parts.length === 0 || (parts.length === 1 && parts[0] === "actes")) {
        if (method === "GET") {
          return await listActes(supabase, params, mergedUser);
        }
        if (method === "POST") {
          const body = await request.json();
          return await createActe(supabase, body, mergedUser, request);
        }
      }

      if (parts.length === 2 && parts[0] === "actes") {
        const acteId = parts[1];
        if (method === "GET") {
          return await getActe(supabase, acteId, mergedUser);
        }
        if (method === "PUT") {
          const body = await request.json();
          return await updateActe(supabase, acteId, body, mergedUser, request);
        }
        if (method === "DELETE") {
          return await deleteActe(supabase, acteId, mergedUser, request);
        }
      }

      if (parts.length === 3 && parts[0] === "actes" && parts[2] === "history") {
        const acteId = parts[1];
        if (method === "GET") {
          return await getActeHistory(supabase, acteId, mergedUser);
        }
      }
    }

    // Route: /proofs
    if (parts[0] === "proofs") {
      if (parts.length === 1) {
        if (method === "GET") {
          return await listProofs(supabase, params, mergedUser);
        }
        if (method === "POST") {
          const ct = request.headers.get("content-type") || "";
          if (ct.includes("multipart/form-data")) {
            // Handle multipart upload: file + metadata
            const form = await request.formData();
            const file = form.get("file");
            if (!file) return errorResponse("file is required", 400);

            // Read file bytes
            const arrayBuffer = await file.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);

            // Compute SHA-256 if not provided
            let hash = form.get("hash_sha256") || null;
            if (!hash) {
              const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
              const h = Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
              hash = h;
            }

            // Upload to storage
            const fileExt = (form.get("original_filename") || file.name || "").split(".").pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `proofs/${mergedUser.id}/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("civic-proofs")
              .upload(filePath, uint8, { contentType: file.type });

            if (uploadError) {
              console.error("Storage upload failed:", uploadError);
              return errorResponse("Storage upload failed", 500, uploadError.message);
            }

            const { data: urlData } = await supabase.storage
              .from("civic-proofs")
              .getPublicUrl(filePath);
            const publicUrl = urlData?.publicUrl || null;

            const payload = {
              type: form.get("type") || form.get("role") || "AUTRE",
              source_org: form.get("source_org") || "CITOYEN",
              date_emission: form.get("date_emission") || form.get("date_constat") || null,
              date_reception: form.get("date_reception") || null,
              hash_sha256: hash,
              storage_url: publicUrl,
              original_filename: form.get("original_filename") || file.name,
              file_size_bytes: uint8.length,
              mime_type: file.type || null,
              probative_force: form.get("probative_force") || "FAIBLE",
              metadata: form.get("metadata")
                ? JSON.parse(form.get("metadata"))
                : { uploaded_via: "ui" },
            };

            return await createProof(supabase, payload, mergedUser, request);
          }

          // Default: expect JSON
          const body = await request.json();
          return await createProof(supabase, body, mergedUser, request);
        }
      }

      if (parts.length === 2 && parts[1] && method === "DELETE") {
        const proofId = parts[1];
        return await deleteProof(supabase, proofId, mergedUser, request);
      }

      if (parts.length === 3 && parts[2] === "verify") {
        const proofId = parts[1];
        if (method === "POST") {
          const body = await request.json().catch(() => ({}));
          return await verifyProof(supabase, proofId, body, mergedUser, request);
        }
      }
    }

    // Route: /proof-links
    if (parts[0] === "proof-links") {
      if (parts.length === 1 && method === "POST") {
        const body = await request.json();
        return await createProofLink(supabase, body, mergedUser, request);
      }
      if (parts.length === 1 && method === "GET") {
        return await listProofLinks(supabase, params, mergedUser);
      }
    }

    return errorResponse("Not Found", 404);
  } catch (error) {
    console.error("Unexpected error:", error);
    return errorResponse("Internal Server Error", 500, error.message);
  }
}
