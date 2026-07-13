import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MAGISTRAL_DIR = path.resolve(SCRIPT_DIR, "..");

// Load env
function loadEnvFromFile(envPath) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnvFromFile(path.resolve(MAGISTRAL_DIR, "../../../survey/.env"));
loadEnvFromFile(path.resolve(MAGISTRAL_DIR, "../.env"));

async function testGeminiJson() {
  const url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
  };
  const body = {
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content:
          "You are a JSON parameter extractor. Return ONLY valid JSON with no conversational text.",
      },
      {
        role: "user",
        content:
          "Extract locale (2-letter code), intent, and needs_rag (boolean) from this prompt: 'Recherche-moi les documents sur la Corse en français'",
      },
    ],
    temperature: 0.1,
    // max_tokens removed
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log("Gemini Output content (no max_tokens):");
  console.log(data.choices?.[0]?.message?.content);
  console.log("Full data:", JSON.stringify(data, null, 2));
}

testGeminiJson();
