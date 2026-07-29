#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MAGISTRAL_DIR = path.resolve(SCRIPT_DIR, "..");
const MAP_FILE = path.join(MAGISTRAL_DIR, "registry", "maps", "default.json");
const REPORT_FILE = path.join(MAGISTRAL_DIR, "COMPETITION_LEADERBOARD.md");
const RESULTS_JSON = path.join(MAGISTRAL_DIR, "competition-results.json");

// 1. Load environment variables
function loadEnvFromFile(envPath) {
  try {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key] || process.env[key] === "") {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (e) {
    console.warn(`Failed to load env file: ${envPath}`, e.message);
  }
}

function loadEnv() {
  // Load survey .env (often rich in external keys)
  loadEnvFromFile(path.resolve(MAGISTRAL_DIR, "../../../survey/.env"));
  // Load inseme .env
  loadEnvFromFile(path.resolve(MAGISTRAL_DIR, "../.env"));
  // Load production secrets
  loadEnvFromFile("/srv/cogentia/secrets/guide.env");
  loadEnvFromFile("/srv/cogentia/secrets/ona.env");
  loadEnvFromFile("/etc/cogentia/guide.env");
  loadEnvFromFile("/etc/cogentia/ona.env");

  // Key normalization / alias mapping
  if (process.env.GROC_API_KEY && !process.env.GROQ_API_KEY) {
    process.env.GROQ_API_KEY = process.env.GROC_API_KEY;
  }
}
loadEnv();

// Helper to get API key for a node
function getApiKeyForNode(node) {
  const url = node.url || "";
  if (node.apiKey || node.api_key) return node.apiKey || node.api_key;
  if (node.apiKeyEnv && process.env[node.apiKeyEnv]) return process.env[node.apiKeyEnv];
  if (url.includes("groq.com")) return process.env.GROQ_API_KEY || "";
  if (url.includes("together.xyz") || url.includes("together.ai"))
    return process.env.TOGETHER_API_KEY || "";
  if (url.includes("openai.com")) return process.env.OPENAI_API_KEY || "";
  if (url.includes("anthropic.com")) return process.env.ANTHROPIC_API_KEY || "";
  if (url.includes("mistral.ai")) return process.env.MISTRAL_API_KEY || "";
  if (url.includes("googleapis.com") || url.includes("google.com"))
    return process.env.GEMINI_API_KEY || "";
  return "";
}

// 2. Define Benchmark Test Cases (representing core Inseme usage)
const TEST_CASES = [
  {
    name: "Guide RAG Synthesis",
    payload: {
      messages: [
        {
          role: "system",
          content:
            "You are Cogentia Guide, an AI assistant. Synthesize a concise answer using the provided context. You must cite the exact source in the format [repo:file#L12-L34] where applicable.",
        },
        {
          role: "user",
          content: `Context:\n[marenostrum:research/DHITL.md#L10-L20]: DHITL stands for Developer-Human-in-the-Loop. It is an alignment framework designed to prevent vendor capture of public cognitive infrastructure by anchoring agents to developer-validated state machines.\n\nQuestion: What is DHITL?`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    },
    evaluate: (output) => {
      let score = 0;
      const details = [];

      if (output.toLowerCase().includes("developer-human-in-the-loop")) {
        score += 3;
        details.push("Found 'Developer-Human-in-the-Loop' (+3)");
      } else {
        details.push("Missing keyword 'Developer-Human-in-the-Loop'");
      }

      if (output.includes("[marenostrum:research/DHITL.md#L10-L20]")) {
        score += 4;
        details.push("Found exact source citation format (+4)");
      } else if (output.includes("marenostrum") || output.includes("DHITL.md")) {
        score += 2;
        details.push("Partial source citation found (+2)");
      } else {
        details.push("Missing source citation");
      }

      if (output.length > 20 && output.length < 500) {
        score += 3;
        details.push("Appropriate response length (+3)");
      } else {
        details.push("Response too short or verbose");
      }

      return { score: (score / 10) * 100, details: details.join(", ") };
    },
  },
  {
    name: "Inox VM Code Generation",
    payload: {
      messages: [
        {
          role: "system",
          content:
            "You are an assistant specialized in the Inox stack-based VM. Output ONLY the code block, no extra comments.",
        },
        {
          role: "user",
          content: "Write an Inox push operation to push the number 42 onto the stack.",
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    },
    evaluate: (output) => {
      let score = 0;
      const details = [];

      if (output.includes("```")) {
        score += 3;
        details.push("Outputted clean code block (+3)");
      } else {
        details.push("No code block syntax");
      }

      if (output.includes("42")) {
        score += 4;
        details.push("Contains number 42 (+4)");
      } else {
        details.push("Missing target value 42");
      }

      if (output.length < 150) {
        score += 3;
        details.push("Strictly concise (+3)");
      } else {
        details.push("Contains verbose extra explanation");
      }

      return { score: (score / 10) * 100, details: details.join(", ") };
    },
  },
  {
    name: "JSON Parameter Extraction",
    payload: {
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
      max_tokens: 150,
    },
    evaluate: (output) => {
      let score = 0;
      const details = [];
      let parsed = null;

      try {
        const cleanJson = output.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleanJson);
        score += 4;
        details.push("Valid JSON parsed (+4)");
      } catch (e) {
        details.push("Failed to parse JSON");
      }

      if (parsed) {
        if (parsed.locale === "fr") {
          score += 3;
          details.push("Correct locale 'fr' (+3)");
        } else {
          details.push(`Wrong locale: ${parsed.locale}`);
        }

        if (parsed.needs_rag === true) {
          score += 3;
          details.push("Correct needs_rag boolean (+3)");
        } else {
          details.push("Missing needs_rag field or wrong type");
        }
      }

      return { score: (score / 10) * 100, details: details.join(", ") };
    },
  },
];

// 3. Execution function
async function runModelBenchmark(node) {
  const apiKey = getApiKeyForNode(node);
  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const results = [];
  console.log(`\n🤖 Testing Node: ${node.id} (${node.model})`);

  for (const tc of TEST_CASES) {
    const body = {
      model: node.model,
      ...tc.payload,
    };
    if (node.url.includes("googleapis.com") || node.url.includes("google.com")) {
      delete body.max_tokens;
    }

    const start = Date.now();
    try {
      const res = await fetch(node.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000), // 120 second timeout per call
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const latency = Date.now() - start;
      const content = data.choices?.[0]?.message?.content || "";
      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;

      const { score, details } = tc.evaluate(content);
      const tokensPerSec =
        latency > 0 ? Math.round((completionTokens || content.length / 4) / (latency / 1000)) : 0;

      results.push({
        testName: tc.name,
        success: true,
        latency,
        tokensPerSec,
        score,
        details,
        promptTokens,
        completionTokens,
      });
      console.log(`  ✓ ${tc.name}: Score=${score}% Latency=${latency}ms Speed=${tokensPerSec} t/s`);
    } catch (e) {
      console.log(`  ❌ ${tc.name} Failed: ${e.message}`);
      results.push({
        testName: tc.name,
        success: false,
        latency: 0,
        tokensPerSec: 0,
        score: 0,
        details: `Error: ${e.message}`,
        promptTokens: 0,
        completionTokens: 0,
      });
    }
  }

  return results;
}

async function main() {
  console.log("=========================================================");
  console.log("             MAGISTRAL PERIODIC MODEL COMPETITION        ");
  console.log("=========================================================");

  if (!fs.existsSync(MAP_FILE)) {
    console.error(`Map file not found at: ${MAP_FILE}`);
    process.exit(1);
  }

  const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf-8"));
  console.log(`Loaded ${map.length} models from routing map.\n`);

  const leaderboard = [];

  for (const node of map) {
    const results = await runModelBenchmark(node);

    const successes = results.filter((r) => r.success);
    const successRate = Math.round((successes.length / results.length) * 100);
    const avgScore =
      successes.length > 0
        ? Math.round(successes.reduce((acc, r) => acc + r.score, 0) / successes.length)
        : 0;
    const avgLatency =
      successes.length > 0
        ? Math.round(successes.reduce((acc, r) => acc + r.latency, 0) / successes.length)
        : 0;
    const avgSpeed =
      successes.length > 0
        ? Math.round(successes.reduce((acc, r) => acc + r.tokensPerSec, 0) / successes.length)
        : 0;

    // Overall competitive score: 50% Quality Score + 30% Speed + 20% Success Rate
    // (Speed score is normalized relative to a target of 100 tokens/sec)
    const speedScore = Math.min(100, (avgSpeed / 100) * 100);
    const competitiveScore = Math.round(avgScore * 0.5 + speedScore * 0.3 + successRate * 0.2);

    leaderboard.push({
      nodeId: node.id,
      model: node.model,
      tier: node.tier,
      successRate,
      avgScore,
      avgLatency,
      avgSpeed,
      competitiveScore,
      results,
    });
  }

  // Sort by competitive score descending
  leaderboard.sort((a, b) => b.competitiveScore - a.competitiveScore);

  // Generate Report Markdown
  let report = `# 🏆 Magistral Model Competition Leaderboard\n\n`;
  report += `*Generated dynamically on: ${new Date().toLocaleString()}*\n\n`;
  report += `This leaderboard ranks models based on direct head-to-head competition across three standard representative tasks (Guide RAG Synthesis, Inox VM Code Generation, and JSON Parameter Extraction).\n\n`;
  report += `### Overall Rankings\n\n`;
  report += `| Rank | Model / Node | Competitive Score | Quality Score | Speed (tokens/s) | Avg Latency | Success Rate |\n`;
  report += `| :---: | :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  leaderboard.forEach((item, index) => {
    report += `| **#${index + 1}** | ${item.nodeId} (\`${item.model}\`) | **${item.competitiveScore}** | ${item.avgScore}% | ${item.avgSpeed}/s | ${item.avgLatency}ms | ${item.successRate}% |\n`;
  });

  report += `\n### Detailed Task Breakdowns\n\n`;
  for (const item of leaderboard) {
    report += `#### Model: ${item.nodeId} (${item.model})\n`;
    report += `| Task | Success | Latency | Speed | Quality Score | Details |\n`;
    report += `| :--- | :---: | :---: | :---: | :---: | :--- |\n`;
    for (const r of item.results) {
      report += `| ${r.testName} | ${r.success ? "✓" : "❌"} | ${r.latency}ms | ${r.tokensPerSec}/s | ${r.score}% | ${r.details} |\n`;
    }
    report += `\n`;
  }

  fs.writeFileSync(REPORT_FILE, report);
  fs.writeFileSync(
    RESULTS_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        leaderboard,
      },
      null,
      2
    )
  );
  console.log(`\nCompetition complete! Report saved to: ${REPORT_FILE}\n`);

  console.log("=========================================================");
  console.log("                 FINAL LEADERBOARD STANDINGS             ");
  console.log("=========================================================");
  leaderboard.forEach((item, idx) => {
    console.log(
      `${idx + 1}. ${item.nodeId} (${item.model}) - Score: ${item.competitiveScore}% (Quality: ${item.avgScore}%, Speed: ${item.avgSpeed} t/s, Success: ${item.successRate}%)`
    );
  });
  console.log("=========================================================\n");
}

main().catch((err) => {
  console.error("Fatal benchmark error:", err);
});
