import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** `npm run dev`: runs setup if needed, then the API (+ inline worker) and the dashboard. */
const root = fileURLToPath(new URL("../", import.meta.url));
if (!existsSync(path.join(root, ".env"))) {
  console.log("No .env yet — running setup first.\n");
  const r = spawnSync("npm", ["run", "-s", "setup"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
process.loadEnvFile(path.join(root, ".env"));

const procs = [
  { name: "api", color: 36, args: ["run", "-s", "start:api"] },
  { name: "web", color: 35, args: ["run", "-s", "start:web"] },
].map(({ name, color, args }) => {
  const child = spawn("npm", args, { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream: NodeJS.ReadableStream, out: NodeJS.WriteStream) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += String(d);
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) out.write(`${prefix}${l}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`${prefix}exited with ${code}`);
    shutdown(code ?? 0);
  });
  return child;
});

console.log(
  `\n  Dashboard  http://localhost:${process.env.ADLAB_WEB_PORT || 5173}   password: ${process.env.ADLAB_DASHBOARD_PASSWORD}`,
);
console.log(`  API        http://localhost:${process.env.ADLAB_API_PORT || 8787}\n`);

let stopping = false;
function shutdown(code: number) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) p.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
