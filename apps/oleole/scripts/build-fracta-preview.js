import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const viteCli = path.resolve(path.dirname(require.resolve("vite")), "../../bin/vite.js");

function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd: appDirectory,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([
  path.resolve(appDirectory, "../../packages/cop-host/scripts/compile-briques.js"),
  "--app",
  "oleole",
  "--profile",
  "brique-profiles/oleole.json",
]);
run([viteCli, "build"], {
  ...process.env,
  VITE_BASE_PATH: "/oleole/",
  VITE_OUT_DIR: "dist-fracta-preview",
});
