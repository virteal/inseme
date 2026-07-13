async function testAgentGateway() {
  const url = "http://127.0.0.1:8793/v1/chat/completions";
  const body = {
    model: "grok-build",
    messages: [
      {
        role: "user",
        content:
          "Extract locale (2-letter code), intent, and needs_rag (boolean) from this prompt: 'Recherche-moi les documents sur la Corse en français'",
      },
    ],
    temperature: 0.1,
    max_tokens: 150,
  };

  try {
    console.log("Testing Agent Gateway...");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Agent Gateway test failed:", e.message);
  }
}

testAgentGateway();
