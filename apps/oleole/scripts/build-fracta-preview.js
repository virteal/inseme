import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, env = process.env) {
  const result = spawnSync(pnpm, args, {
    cwd: new URL("..", import.meta.url),
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["run", "compile:briques"]);
run(["vite", "build"], {
  ...process.env,
  VITE_BASE_PATH: "/oleole/",
  VITE_OUT_DIR: "dist-fracta-preview",
});
