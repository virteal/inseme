// File: netlify/edge-functions/cop-admin-tasks.js
// Description:
//   Netlify Edge Function exposing a minimal admin API for COP tasks.
//
//   GET /cop-admin-tasks
//     - List tasks (optionally filtered)
//       Query params:
//         ?status=pending|running|completed|failed|cancelled
//         &task_type=AUDIT_LEGAL_STATE
//         &worker_agent_name=Ophélia
//
//   GET /cop-admin-tasks?id=<task_id>
//     - Get a single task with its steps
//
//   (POST could be added later for admin actions like force-fail, retry, etc.)

import { getDefaultStorage } from "../../packages/cop-kernel/src/storage.js";

export default async function handler(request, context) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  try {
    if (method === "GET") {
      return await handleGet(url);
    }

    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        detail: err && err.message ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleGet(url) {
  const id = url.searchParams.get("id");
  const storage = getDefaultStorage();

  // Cas 1 : détail d'un task
  if (id) {
    const taskRes = await storage.tasks.get(id);
    if (!taskRes.ok) {
      return new Response(JSON.stringify({ error: "task_load_error", detail: taskRes.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!taskRes.task) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stepsRes = await storage.steps.listByTask(id);
    if (!stepsRes.ok) {
      return new Response(JSON.stringify({ error: "steps_load_error", detail: stepsRes.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = {
      task: taskRes.task,
      steps: stepsRes.steps || [],
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cas 2 : liste des tasks
  const status = url.searchParams.get("status") || undefined;
  const task_type = url.searchParams.get("task_type") || undefined;
  const worker_agent_name = url.searchParams.get("worker_agent_name") || undefined;

  const listRes = await storage.tasks.list({
    status,
    task_type,
    worker_agent_name,
  });

  if (!listRes.ok) {
    return new Response(JSON.stringify({ error: "tasks_list_error", detail: listRes.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(listRes.tasks || []), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
