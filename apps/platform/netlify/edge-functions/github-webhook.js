/* global Deno */
// Deno Edge Function: GitHub App Webhook Ingress (Issue #29)
// Path: /api/webhooks/github
// Environment: Netlify Deno Edge Functions / Supabase Edge Runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify GitHub App Webhook HMAC-SHA256 signature using native Web Crypto API (Deno standard).
 */
async function verifyHmacSignature(rawText, signatureHeader, secret) {
  if (!signatureHeader || !secret || !rawText) return false;
  const parts = signatureHeader.trim().split("=");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "sha256") return false;
  const expectedHex = parts[1].toLowerCase();

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify", "sign"]
    );
    const data = encoder.encode(rawText);
    const signatureBytes = new Uint8Array(
      expectedHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );

    return await crypto.subtle.verify("HMAC", key, signatureBytes, data);
  } catch {
    return false;
  }
}

/**
 * Calculate canonical SHA-256 hex digest using Web Crypto API.
 */
async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default async (request, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-GitHub-Delivery, X-GitHub-Event, X-Hub-Signature-256",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const deliveryId = request.headers.get("x-github-delivery") || "";
  const eventName = request.headers.get("x-github-event") || "";
  const signatureHeader = request.headers.get("x-hub-signature-256") || "";

  if (!deliveryId || !eventName) {
    return new Response(JSON.stringify({ ok: false, error: "missing_github_headers" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const webhookSecret =
    Deno.env.get("GITHUB_WEBHOOK_SECRET") || Deno.env.get("COGENTIA_GITHUB_WEBHOOK_SECRET");
  const rawText = await request.text();

  // 1. HMAC Signature Verification (if secret is configured)
  if (webhookSecret) {
    const isValid = await verifyHmacSignature(rawText, signatureHeader, webhookSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_hmac_signature" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
  }

  let payload = {};
  try {
    payload = JSON.parse(rawText || "{}");
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json_payload" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const repositoryName = payload?.repository?.full_name || null;
  const action = payload?.action || null;
  const senderLogin = payload?.sender?.login || null;
  const installationId = payload?.installation?.id ? Number(payload.installation.id) : null;
  const payloadHash = await sha256Hex(rawText);

  // 2. Supabase Storage & Event Normalization
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY");

  if (supabaseUrl && supabaseServiceKey) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Persist raw delivery record
    await supabase.from("github_webhook_deliveries").upsert(
      {
        delivery_id: deliveryId,
        event_name: eventName,
        action,
        repository_name: repositoryName,
        installation_id: installationId,
        sender_login: senderLogin,
        signature_sha256: signatureHeader,
        payload_sha256: payloadHash,
        processing_state: "received",
        received_at: new Date().toISOString(),
      },
      { onConflict: "delivery_id" }
    );

    // Normalize cop.event/v1 fact
    const topicId = `github:${repositoryName || "global"}`;
    const actorId = senderLogin ? `github:${senderLogin}` : "github:anonymous";
    const idempotencyKey = `github:${deliveryId}:${eventName}`;

    await supabase.from("cop_event_log").upsert(
      {
        topic_id: topicId,
        topic_seq: Date.now(), // Monotonic sequence timestamp
        event_type: "cop.event/v1",
        actor_id: actorId,
        epistemic_status: "observed",
        origin_ref: `github:delivery:${deliveryId}`,
        payload: {
          github_event: eventName,
          action,
          repository: repositoryName,
          installation_id: installationId,
          summary: `GitHub Event ${eventName} (${action || "no-action"}) on ${repositoryName || "unknown"}`,
          details: { sender: senderLogin, payload_hash: payloadHash },
        },
        meta: {
          delivery_id: deliveryId,
          received_at: new Date().toISOString(),
        },
        idempotency_key: idempotencyKey,
      },
      { onConflict: "idempotency_key" }
    );
  }

  // 3. Fast 202 Accepted Response
  return new Response(
    JSON.stringify({
      ok: true,
      accepted: true,
      delivery_id: deliveryId,
      event: eventName,
      repository: repositoryName,
    }),
    {
      status: 202,
      headers: corsHeaders,
    }
  );
};
