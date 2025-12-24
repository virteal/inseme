#!/usr/bin/env node
// scripts/set-ngrok.js
// Node >=16. Use: node scripts/set-ngrok.js --on [--port 5173] or --off

import ngrok from "ngrok";
import minimist from "minimist";
import { loadConfig, getConfig } from "./lib/config.js";

// Charger la configuration
await loadConfig();

const argv = minimist(process.argv.slice(2));
const PORT = argv.port || getConfig("port", 8888);
const SUPABASE_URL = getConfig("supabase_url");
const SERVICE_KEY = getConfig("supabase_service_role_key");
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

async function patchSiteConfig({ enabled, url }) {
  // get first user id (assumes a users row exists)
  const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id&limit=1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const users = await usersRes.json();
  if (!users || users.length === 0) throw new Error("No users row found to patch.");
  const id = users[0].id;

  const body = {
    metadata: { site_config: { redirect_enabled: enabled, redirect_url: url || null } },
  };
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!patchRes.ok) {
    const text = await patchRes.text();
    throw new Error(`Patch failed: ${patchRes.status} ${text}`);
  }
  console.log(`site_config updated: enabled=${enabled} url=${url}`);
}

async function notifyDeployedControl() {
  const controlUrl =
    getConfig("deployed_control_url") ||
    ((getConfig("app_base_url") || getConfig("deploy_url")) &&
      `${(getConfig("app_base_url") || getConfig("deploy_url")).replace(/\/$/, "")}/.netlify/functions/ngrok-control`);
  const secret = getConfig("ngrok_control_secret");
  if (!controlUrl || !secret) {
    console.log("No deployed control URL or NGROK_CONTROL_SECRET set; skipping deployed notify.");
    return;
  }
  try {
    console.log("Notifying deployed control endpoint:", controlUrl);
    const res = await fetch(controlUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh" }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn("Deployed notify returned non-OK:", res.status, txt);
    } else {
      console.log("Deployed instance notified successfully.");
    }
  } catch (err) {
    console.warn("Failed to call deployed control endpoint:", err.message);
  }
}

async function startAndNotify() {
  console.log(`Starting ngrok tunnel for port ${PORT}...`);
  const url = await ngrok.connect({ addr: Number(PORT) });
  console.log("ngrok url:", url);
  await patchSiteConfig({ enabled: true, url });
  return url;
}

async function stopAndNotify() {
  try {
    await patchSiteConfig({ enabled: false, url: null });
  } catch (e) {
    console.error("Failed to patch site_config off:", e.message);
  }
  try {
    await ngrok.disconnect();
    await ngrok.kill();
  } catch (e) {
    // ignore
  }
}

(async () => {
  try {
    if (argv.off) {
      await stopAndNotify();
      // also tell deployed instance to refresh
      await notifyDeployedControl();
      console.log("Disabled redirect and stopped ngrok (if running).");
      return;
    }
    const url = argv.url ? argv.url : await startAndNotify();

    // cleanup on exit
    const cleanup = async () => {
      console.log("Cleaning up: disabling redirect and stopping ngrok...");
      await stopAndNotify();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    console.log("Tunnel running — press Ctrl+C to stop and disable remote redirect.");
    // keep process alive
    /* eslint-disable no-constant-condition */
    while (true) await new Promise((r) => setTimeout(r, 60_000));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
