import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJhnLocalCapabilityIssuer } from "../mcp/cop/localCapabilityIssuer.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultStateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const separator = process.argv.indexOf("--");
if (separator === -1 || separator === process.argv.length - 1) {
  throw new Error(
    "Usage: node scripts/run-jhn-local-cop-command.js [--state-dir directory] [--runtime-url url] -- command [args...]"
  );
}

const issuer = await createJhnLocalCapabilityIssuer({
  stateDirectory: argumentValue("--state-dir") ?? defaultStateDirectory,
});
try {
  const capability = await issuer.issue({ subject: "principal:jhn:runtime" });
  const child = spawn(process.argv[separator + 1], process.argv.slice(separator + 2), {
    env: {
      ...process.env,
      COP_CAPABILITY: capability,
      COP_RUNTIME_URL: argumentValue("--runtime-url") ?? "http://127.0.0.1:8787",
    },
    shell: false,
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  process.exitCode = exitCode;
} finally {
  issuer.close();
}
