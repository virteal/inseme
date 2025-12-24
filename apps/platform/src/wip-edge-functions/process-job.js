// Netlify Edge Function (Deno) to claim and process a single COP task
// This is designed to be invoked by a cron or queue worker (short-lived function)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_KEY");

export default async function handler(request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase env vars missing" }), { status: 500 });
  }
  try {
    // Claim a task via RPC
    const leaseUntil = new Date(Date.now() + 60 * 1000).toISOString();
    const workerId = `edge-${crypto.randomUUID()}`;
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cop_claim_task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ p_worker_id: workerId, p_lease_until: leaseUntil }),
    });
    if (!rpcRes.ok)
      return new Response(JSON.stringify({ error: "No task claimed" }), { status: 204 });
    const tasks = await rpcRes.json();
    if (!tasks || tasks.length === 0)
      return new Response(JSON.stringify({ ok: "no tasks" }), { status: 200 });
    const task = tasks[0];
    // Fetch next pending step
    const stepsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cop_step?task_id=eq.${task.id}&status=eq.pending&order=created_at.asc&limit=1`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      }
    );
    if (!stepsRes.ok) throw new Error("Failed to fetch steps");
    const [step] = await stepsRes.json();
    if (!step) {
      // Nothing to do, mark task done if required
      await fetch(`${SUPABASE_URL}/rest/v1/cop_task?id=eq.${task.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "done" }),
      });
      return new Response(JSON.stringify({ ok: "task done" }), { status: 200 });
    }
    // Mark step running and publish task_step_started write-ahead
    await fetch(`${SUPABASE_URL}/rest/v1/cop_step?id=eq.${step.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "running" }),
    });
    await fetch(`${SUPABASE_URL}/rest/v1/cop_event`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic_id: task.topic_id,
        type: "task_step_started",
        payload: { task_id: task.id, step_id: step.id },
        meta: {},
      }),
    });

    // Simulate step processing: here you would call the RAG pipeline or LLM
    // For now, we simulate by composing a response
    const inputText = step.input?.text || "";
    const outputText = `RAG edge: Analyse automatiques: ${inputText.slice(0, 200)}`;

    // Save step output and mark done (idempotent)
    await fetch(`${SUPABASE_URL}/rest/v1/cop_step?id=eq.${step.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ output: { text: outputText }, status: "done" }),
    });

    // Save artifact only if not exists
    const existingArtRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cop_artifact?source_task_id=eq.${task.id}&source_step_id=eq.${step.id}&type=eq.deep_answer`,
      { method: "GET", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
    );
    let art = null;
    if (existingArtRes.ok) {
      const existing = await existingArtRes.json();
      if (existing && existing.length > 0) art = existing[0];
    }
    if (!art) {
      const artRes = await fetch(`${SUPABASE_URL}/rest/v1/cop_artifact`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic_id: task.topic_id,
          source_task_id: task.id,
          source_step_id: step.id,
          type: "deep_answer",
          format: "text",
          payload: { text: outputText },
          created_by: null,
        }),
      });
      art = await artRes.json();
    }

    // Publish an event to cop_event (only if artifact created)
    if (art) {
      await fetch(`${SUPABASE_URL}/rest/v1/cop_event`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic_id: task.topic_id,
          type: "artifact_created",
          payload: { artifact_id: art?.id },
          meta: {},
        }),
      });
    }

    // If no more pending steps, mark task done
    const pendingStepsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cop_step?task_id=eq.${task.id}&status=eq.pending`,
      { method: "GET", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
    );
    const pending = await pendingStepsRes.json();
    if (!pending || pending.length === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/cop_task?id=eq.${task.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "done", worker_id: null, lease_expires_at: null }),
      });
    }

    return new Response(
      JSON.stringify({
        ok: "processed step",
        taskId: task.id,
        stepId: step.id,
        artifactId: art?.id,
      }),
      { status: 200 }
    );
  } catch (e) {
    console.error("process-task edge error", e?.message || e);
    // Attempt to update task: clear lease so it can be claimed again
    try {
      if (tasks && tasks[0]) {
        await fetch(`${SUPABASE_URL}/rest/v1/cop_task?id=eq.${tasks[0].id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lease_expires_at: null, worker_id: null }),
        });
      }
    } catch (e2) {
      console.warn("failed to clear task lease", e2?.message || e2);
    }
    return new Response(JSON.stringify({ error: e?.message || "" }), { status: 500 });
  }
}
