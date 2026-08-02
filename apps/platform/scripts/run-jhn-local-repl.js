import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import OpenAI from "openai";
import { createJhnLocalAgent } from "../mcp/cop/jhnLocalAgent.js";
import { readJhnConversationState } from "../mcp/cop/jhnConversationState.js";
import { createJhnLocalCapabilityIssuer } from "../mcp/cop/localCapabilityIssuer.js";
import { createJhnLocalCopRuntime } from "../mcp/cop/localRuntimeServer.js";
import { createOpenAIJhnReasoner } from "../mcp/cop/jhnReasoner.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const stateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");
const conversationId = process.argv[2] ?? "john";

if (!process.env.OPENAI_API_KEY) {
  const env = await readFile(path.resolve(scriptDirectory, "..", "..", "..", ".env"), "utf8");
  const match = env.match(/^\s*OPENAI_API_KEY\s*=\s*([^\r\n#]+)\s*$/m);
  if (match) process.env.OPENAI_API_KEY = match[1].trim().replace(/^['"]|['"]$/g, "");
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is unavailable");

const runtime = await createJhnLocalCopRuntime({ stateDirectory });
const address = await runtime.listen();
const issuer = await createJhnLocalCapabilityIssuer({ stateDirectory });
const reasoner = createOpenAIJhnReasoner({
  client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
});
const readline = createInterface({ input: stdin, output: stdout });

console.log(`John local — conversation ${conversationId}. Type /exit to stop.`);
try {
  for (;;) {
    const message = (await readline.question("You> ")).trim();
    if (message === "/exit" || message === "/quit") break;
    if (!message) continue;
    const capability = await issuer.issue({ subject: "principal:jhn:runtime" });
    const agent = createJhnLocalAgent({
      runtimeUrl: `http://${address.host}:${address.port}`,
      capability,
      reasoner,
    });
    const state = readJhnConversationState({ stateDirectory, conversationId });
    const result = await agent.turn({ message, conversationId, history: state.history });
    console.log(`John> ${result.text}`);
  }
} finally {
  readline.close();
  issuer.close();
  await runtime.close();
}
