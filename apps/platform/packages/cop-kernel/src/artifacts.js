// File: packages/cop-kernel/src/artifacts.js
// Description:
//   Helpers to persist COP artifacts via StorageInterface.artifacts.
//   Optionally emits a COP_EVENT over HTTP (transport layer).

import { getStorage } from "./storage.js";
import { emitCopEvent } from "./events.js";
import { COP_VERSION } from "./message.js";

/**
 * Persist a high-level COP artifact and optionally emit an event.
 *
 * @param {Object} params
 * @param {string} params.artifactType
 * @param {string} params.artifactKind
 * @param {string} [params.correlationId]
 * @param {string} [params.messageId]
 * @param {string} [params.eventId]
 * @param {string} [params.taskId]
 * @param {string} [params.taskStepId]
 * @param {Object} params.agent
 * @param {any}    params.content
 * @param {Object} [params.metadata]
 * @param {boolean} [params.emitEvent=false]
 * @param {string}  [params.from]
 * @param {string}  [params.endpoint]
 * @param {string}  [params.baseUrl]
 * @param {string}  [params.eventsPath="/cop-events"]
 * @param {string}  [params.copVersion=COP_VERSION]
 * @param {boolean} [params.throwOnError=true]
 */
export async function emitCopArtifact(params) {
  const storage = getStorage();
  const {
    artifactType,
    artifactKind,

    correlationId = null,
    messageId = null,
    eventId = null,

    taskId = null,
    taskStepId = null,

    agent,
    content,
    metadata = {},

    emitEvent = false,
    from,
    endpoint,
    baseUrl,
    eventsPath = "/cop-events",
    copVersion = COP_VERSION,

    throwOnError = true,
  } = params || {};

  if (!artifactType) {
    throw new Error("emitCopArtifact: 'artifactType' is required");
  }
  if (!artifactKind) {
    throw new Error("emitCopArtifact: 'artifactKind' is required");
  }
  if (!agent || typeof agent.agentName !== "string") {
    throw new Error("emitCopArtifact: valid 'agent' (with agentName) is required");
  }

  const row = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(16).slice(2),

    correlation_id: correlationId,
    message_id: messageId,
    event_id: eventId,

    task_id: taskId,
    task_step_id: taskStepId,

    network_id: agent.networkId || null,
    node_id: agent.nodeId || null,
    instance_id: agent.instanceId || null,
    agent_name: agent.agentName,

    artifact_type: artifactType,
    artifact_kind: artifactKind,

    content,
    metadata,
    created_at: new Date().toISOString(),
  };

  let inserted = null;
  let errorObj = null;

  try {
    inserted = await storage.artifacts.insert(row);
  } catch (err) {
    errorObj = err;
    if (throwOnError) {
      throw err;
    }
  }

  if (emitEvent && inserted) {
    try {
      await emitCopEvent({
        from,
        endpoint,
        baseUrl,
        path: eventsPath,
        event: {
          cop_version: copVersion,
          event_type: "ARTIFACT_CREATED",
          artifact: inserted,
        },
      });
    } catch (err) {
      if (throwOnError) {
        throw err;
      }
    }
  }

  return {
    ok: !errorObj,
    artifact: inserted,
    error: errorObj ? String(errorObj.message || errorObj) : null,
  };
}
