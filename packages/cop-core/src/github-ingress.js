/**
 * GitHub Webhook Ingress & Normalizer for COP Append-Only Event Log (Issue #29)
 *
 * Implements:
 * 1. HMAC-SHA256 signature verification (X-Hub-Signature-256)
 * 2. Webhook delivery normalization & payload SHA-256 computation
 * 3. Event mapper (GitHub Event -> cop.event/v1 durable fact)
 * 4. Observed repositories allowlist validation
 */

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

/**
 * Verify GitHub App Webhook HMAC-SHA256 signature (X-Hub-Signature-256).
 *
 * @param {string|Buffer} rawBody - Raw body payload (must not be pre-parsed JSON)
 * @param {string} signatureHeader - Header value of X-Hub-Signature-256 (e.g. "sha256=abcdef...")
 * @param {string} webhookSecret - Secret configured in GitHub App and Supabase instance_config
 * @returns {boolean} True if signature matches exactly
 */
export function verifyGithubHmacSignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret || !rawBody) {
    return false;
  }

  const parts = signatureHeader.trim().split("=");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "sha256") {
    return false;
  }

  const expectedHash = parts[1];
  const hmac = createHmac("sha256", webhookSecret);
  hmac.update(rawBody);
  const calculatedHash = hmac.digest("hex");

  try {
    const expectedBuf = Buffer.from(expectedHash, "hex");
    const calculatedBuf = Buffer.from(calculatedHash, "hex");
    if (expectedBuf.length !== calculatedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, calculatedBuf);
  } catch {
    return false;
  }
}

/**
 * Normalize an incoming raw GitHub webhook delivery.
 *
 * @param {object} headers - HTTP request headers
 * @param {object} payload - Parsed JSON body payload
 * @param {string|Buffer} rawBody - Raw body payload for SHA-256 calculation
 * @returns {object} Normalized delivery record
 */
export function normalizeGithubDelivery(headers, payload, rawBody) {
  const deliveryId = String(
    headers["x-github-delivery"] || headers["X-GitHub-Delivery"] || ""
  ).trim();
  const eventName = String(headers["x-github-event"] || headers["X-GitHub-Event"] || "").trim();
  const signature = String(
    headers["x-hub-signature-256"] || headers["X-Hub-Signature-256"] || ""
  ).trim();
  const action = payload?.action || null;
  const repositoryName = payload?.repository?.full_name || null;
  const installationId = payload?.installation?.id ? Number(payload.installation.id) : null;
  const senderLogin = payload?.sender?.login || null;

  const payloadSha256 = createHash("sha256")
    .update(
      typeof rawBody === "string" || Buffer.isBuffer(rawBody)
        ? rawBody
        : JSON.stringify(payload || {})
    )
    .digest("hex");

  return {
    delivery_id: deliveryId,
    event_name: eventName,
    action,
    repository_name: repositoryName,
    installation_id: installationId,
    sender_login: senderLogin,
    signature_sha256: signature,
    payload_sha256: payloadSha256,
    processing_state: "received",
    received_at: new Date().toISOString(),
  };
}

/**
 * Validate if a repository is on the instance's observed repositories allowlist.
 *
 * @param {string} repositoryName e.g. "JeanHuguesRobert/pertitellu"
 * @param {string[]} allowlist e.g. ["JeanHuguesRobert/JeanHuguesRobert", "JeanHuguesRobert/pertitellu"]
 * @returns {boolean}
 */
export function isRepositoryAllowed(repositoryName, allowlist = []) {
  if (!repositoryName) return false;
  if (!Array.isArray(allowlist) || allowlist.length === 0) return true; // Empty allowlist allows all registered
  const repoLower = repositoryName.trim().toLowerCase();
  return allowlist.some((item) => String(item).trim().toLowerCase() === repoLower);
}

/**
 * Map a GitHub delivery into a normalized cop.event/v1 durable fact.
 *
 * @param {object} delivery - Normalized delivery record
 * @param {object} payload - Parsed GitHub event payload
 * @param {object} [options]
 * @param {string} [options.instanceId] - e.g. "jhn-personal" or "pertitellu-corte"
 * @returns {object} Normalized cop.event/v1 record
 */
export function mapDeliveryToCopEvent(delivery, payload, options = {}) {
  const instanceId = options.instanceId || "jhn-personal";
  const topicId = `github:${delivery.repository_name || "global"}`;
  const actorId = delivery.sender_login ? `github:${delivery.sender_login}` : "github:anonymous";

  let epistemicStatus = "observed";
  let summary = "";
  const details = {};

  switch (delivery.event_name) {
    case "push": {
      const commitCount = Array.isArray(payload?.commits) ? payload.commits.length : 0;
      const ref = payload?.ref || "refs/heads/main";
      const branch = ref.replace("refs/heads/", "");
      summary = `Push of ${commitCount} commit(s) to ${branch} on ${delivery.repository_name} by ${delivery.sender_login}`;
      details.commit_count = commitCount;
      details.branch = branch;
      details.head_commit = payload?.head_commit?.id || null;
      epistemicStatus = "observed";
      break;
    }
    case "pull_request": {
      const prNumber = payload?.number;
      const prTitle = payload?.pull_request?.title || "";
      const prMerged = Boolean(payload?.pull_request?.merged);
      summary = `PR #${prNumber} "${prTitle}" ${delivery.action} on ${delivery.repository_name} by ${delivery.sender_login}`;
      details.pr_number = prNumber;
      details.title = prTitle;
      details.merged = prMerged;
      epistemicStatus = prMerged
        ? "decided"
        : delivery.action === "opened"
          ? "proposed"
          : "observed";
      break;
    }
    case "issues": {
      const issueNumber = payload?.issue?.number;
      const issueTitle = payload?.issue?.title || "";
      summary = `Issue #${issueNumber} "${issueTitle}" ${delivery.action} on ${delivery.repository_name} by ${delivery.sender_login}`;
      details.issue_number = issueNumber;
      details.title = issueTitle;
      epistemicStatus = delivery.action === "opened" ? "proposed" : "observed";
      break;
    }
    case "workflow_run": {
      const workflowName = payload?.workflow?.name || payload?.workflow_run?.name || "Workflow";
      const conclusion = payload?.workflow_run?.conclusion || payload?.action || "started";
      summary = `Workflow "${workflowName}" ${conclusion} on ${delivery.repository_name}`;
      details.workflow_name = workflowName;
      details.conclusion = conclusion;
      epistemicStatus = "published";
      break;
    }
    case "dependabot_alert":
    case "code_scanning_alert":
    case "secret_scanning_alert": {
      summary = `Security Alert (${delivery.event_name}) ${delivery.action} on ${delivery.repository_name}`;
      details.alert_kind = delivery.event_name;
      epistemicStatus = "observed";
      break;
    }
    default: {
      summary = `GitHub Event "${delivery.event_name}" (${delivery.action || "no-action"}) on ${delivery.repository_name || "unknown"}`;
      epistemicStatus = "observed";
      break;
    }
  }

  return {
    topic_id: topicId,
    event_type: "cop.event/v1",
    actor_id: actorId,
    epistemic_status: epistemicStatus,
    origin_ref: `github:delivery:${delivery.delivery_id}`,
    causal_refs: [],
    payload: {
      github_event: delivery.event_name,
      action: delivery.action,
      repository: delivery.repository_name,
      installation_id: delivery.installation_id,
      summary,
      details,
    },
    meta: {
      instance_id: instanceId,
      delivery_id: delivery.delivery_id,
      payload_sha256: delivery.payload_sha256,
      mapped_at: new Date().toISOString(),
    },
    idempotency_key: `github:${delivery.delivery_id}:${delivery.event_name}`,
  };
}
