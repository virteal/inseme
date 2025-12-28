const OPHELIA_URL =
  process.env.OPHELIA_URL || "http://localhost:8888/api/ophelia";

async function testOphelia() {
  console.log(`Testing Ophélia at ${OPHELIA_URL}...`);

  const payload = {
    action: "chat",
    room_id: "test-room-" + Date.now(),
    content: [{ role: "user", content: "Test diagnostic. Réponds par 'OK'." }],
    context: {
      sessionStatus: "open",
      connectedUsers: [],
    },
    system_prompt: "Tu es Ophélia. Réponds brièvement.",
    room_settings: {},
  };

  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(OPHELIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log("Raw Response:", text);

    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`);
      return;
    }

    try {
      const data = JSON.parse(text);
      console.log("✅ Ophélia Response:", JSON.stringify(data, null, 2));
    } catch (e) {
      console.log("❌ Failed to parse JSON response:", e.message);
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
  }
}

testOphelia();
