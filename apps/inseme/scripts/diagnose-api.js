const BASE_URL = process.env.BASE_URL || "http://localhost:8888/api";

async function runDiagnostics() {
  console.log("--- Inseme Backend Diagnostics ---");

  // 1. Test /api/config (Node.js function)
  console.log(`\n1. Testing /api/config at ${BASE_URL}/config...`);
  try {
    const res = await fetch(`${BASE_URL}/config`);
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log("✅ Config loaded successfully.");
      console.log("Keys found:", Object.keys(data).length);
    } else {
      console.log("❌ Config load failed:", await res.text());
    }
  } catch (err) {
    console.log("❌ Config request failed:", err.message);
  }

  // 2. Test /api/ophelia (Edge function)
  console.log(`\n2. Testing /api/ophelia at ${BASE_URL}/ophelia...`);
  try {
    const res = await fetch(`${BASE_URL}/ophelia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ping" }),
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log("Raw Response:", text);
    if (res.ok) {
      console.log("✅ Ophelia edge function reached.");
    } else {
      console.log("❌ Ophelia edge function failed.");
    }
  } catch (err) {
    console.log("❌ Ophelia request failed:", err.message);
  }

  // 3. Test /api/sessions (Edge function)
  console.log(`\n3. Testing /api/sessions at ${BASE_URL}/sessions...`);
  try {
    const res = await fetch(`${BASE_URL}/sessions`);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log("Raw Response:", text);
    if (res.ok) {
      console.log("✅ Sessions edge function reached.");
    } else {
      console.log("❌ Sessions edge function failed.");
    }
  } catch (err) {
    console.log("❌ Sessions request failed:", err.message);
  }
}

runDiagnostics();
