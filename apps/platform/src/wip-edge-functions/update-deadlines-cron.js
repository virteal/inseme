/**
 * Update Deadlines and Statuses - Cron Edge Function
 *
 * This function should be called daily (via Netlify scheduled function or external cron)
 * to process overdue deadlines and automatically create legal status instances.
 *
 * Operations:
 * 1. Find all open deadlines that are past due
 * 2. Mark them as DEPASSEE (exceeded)
 * 3. If a consequence is defined (e.g., REFUS_IMPLICITE), create legal status instance
 * 4. Update related entity status (e.g., demande_admin.status)
 * 5. Log all operations in audit_log
 *
 * Security:
 * - Requires API key authentication (x-api-key header)
 * - Only available to internal cron tasks
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfig } from "../../common/config/instanceConfig.edge.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export default async function handler(request, context) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // Load vault config
    await loadInstanceConfig();

    // Verify API key (for cron authentication)
    const apiKey = request.headers.get("x-api-key");
    const expectedApiKey = getConfig("cron_api_key") || getConfig("supabase_service_role_key");

    if (!apiKey || apiKey !== expectedApiKey) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = getConfig("supabase_url");
    const supabaseKey = getConfig("supabase_service_role_key");

    if (!supabaseUrl || !supabaseKey) {
      return errorResponse("Missing Supabase configuration", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();
    const results = {
      processed: 0,
      exceeded: 0,
      statuses_created: 0,
      demandes_updated: 0,
      errors: [],
    };

    // Get all open deadlines that are past due
    const { data: overdueDeadlines, error: fetchError } = await supabase
      .from("deadline_instance")
      .select(
        `
        id,
        entity_type,
        entity_id,
        template_id,
        due_date,
        template:template_id(
          libelle,
          consequence_depassement,
          consequence_description
        )
      `
      )
      .eq("status", "OUVERTE")
      .lt("due_date", new Date().toISOString().split("T")[0]);

    if (fetchError) {
      console.error("Error fetching overdue deadlines:", fetchError);
      return errorResponse("Failed to fetch deadlines", 500);
    }

    results.processed = overdueDeadlines?.length || 0;

    for (const deadline of overdueDeadlines || []) {
      try {
        // Mark deadline as exceeded
        const { error: updateError } = await supabase
          .from("deadline_instance")
          .update({
            status: "DEPASSEE",
            closed_at: new Date().toISOString(),
            closed_reason: "Délai dépassé automatiquement par cron",
          })
          .eq("id", deadline.id);

        if (updateError) {
          results.errors.push({ deadline_id: deadline.id, error: updateError.message });
          continue;
        }

        results.exceeded++;

        // Create legal status instance if consequence defined
        if (deadline.template?.consequence_depassement) {
          const { data: statusInstance, error: statusError } = await supabase
            .from("legal_status_instance")
            .insert({
              entity_type: deadline.entity_type,
              entity_id: deadline.entity_id,
              status_code: deadline.template.consequence_depassement,
              date_debut: deadline.due_date,
              justification: `Statut généré automatiquement suite au dépassement du délai "${deadline.template.libelle}" (échéance: ${deadline.due_date}). ${deadline.template.consequence_description || ""}`,
              created_by_actor_type: "CRON",
            })
            .select()
            .single();

          if (statusError) {
            results.errors.push({
              deadline_id: deadline.id,
              error: `Failed to create status: ${statusError.message}`,
            });
          } else {
            results.statuses_created++;

            // Update deadline with generated status reference
            await supabase
              .from("deadline_instance")
              .update({ generated_status_id: statusInstance.id })
              .eq("id", deadline.id);

            // Update demande_admin status if applicable
            if (
              deadline.entity_type === "DEMANDE" &&
              deadline.template.consequence_depassement === "REFUS_IMPLICITE"
            ) {
              const { error: demandeError } = await supabase
                .from("demande_admin")
                .update({ status: "REFUS_IMPLICITE" })
                .eq("id", deadline.entity_id)
                .eq("status", "EN_ATTENTE"); // Only update if still pending

              if (!demandeError) {
                results.demandes_updated++;
              }
            }

            // Log in audit
            await supabase.from("civic_audit_log").insert({
              actor_type: "CRON",
              action: "UPDATE",
              entity_type: deadline.entity_type,
              entity_id: deadline.entity_id,
              payload: {
                deadline_id: deadline.id,
                deadline_exceeded: true,
                status_created: deadline.template.consequence_depassement,
                status_instance_id: statusInstance.id,
              },
            });
          }
        } else {
          // Log deadline exceeded without consequence
          await supabase.from("civic_audit_log").insert({
            actor_type: "CRON",
            action: "UPDATE",
            entity_type: deadline.entity_type,
            entity_id: deadline.entity_id,
            payload: {
              deadline_id: deadline.id,
              deadline_exceeded: true,
              status_created: false,
            },
          });
        }
      } catch (err) {
        results.errors.push({ deadline_id: deadline.id, error: err.message });
      }
    }

    const duration = Date.now() - startTime;

    // Log summary
    console.log(
      `Deadline cron completed: ${results.exceeded}/${results.processed} deadlines exceeded, ${results.statuses_created} statuses created, ${results.demandes_updated} demandes updated, ${results.errors.length} errors in ${duration}ms`
    );

    return jsonResponse({
      success: true,
      duration_ms: duration,
      results,
    });
  } catch (error) {
    console.error("Cron error:", error);
    return errorResponse("Internal server error", 500);
  }
}
