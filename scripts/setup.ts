import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDb } from "@adlab/db";
import { REPO_ROOT } from "@adlab/services";
import { syncSkills } from "./sync-skills";

/**
 * One-time (and re-runnable) local setup:
 *   1. checks Node, 2. writes .env with generated secrets (keeps any values you set),
 *   3. applies database migrations, 4. syncs agent skills.
 * `--json` prints a machine-readable summary for agents.
 */
const json = process.argv.includes("--json");
const log = (...a: unknown[]) => !json && console.log(...a);

const [major, minor] = process.versions.node.split(".").map(Number) as [number, number];
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(`Node ${process.versions.node} found; adlab needs Node 22.12 or newer.`);
  process.exit(1);
}

const envPath = path.join(REPO_ROOT, ".env");
const example = readFileSync(path.join(REPO_ROOT, ".env.example"), "utf8");
const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : example;
const secret = (bytes = 24) => randomBytes(bytes).toString("base64url");

const values = new Map<string, string>();
for (const line of current.split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m) values.set(m[1]!, m[2]!);
}
const generated: string[] = [];
const fill = (key: string, value: () => string) => {
  if (!values.get(key)) {
    values.set(key, value());
    generated.push(key);
  }
};
const agentToken = values.get("ADLAB_API_TOKEN") || secret();
fill("ADLAB_API_TOKEN", () => agentToken);
fill("ADLAB_API_TOKENS", () => `local-agent:${agentToken}`);
fill("ADLAB_DASHBOARD_PASSWORD", () => secret(9));
fill("ADLAB_SESSION_SECRET", () => secret(32));

// Rewrite from the example template so comments and ordering stay readable.
const out = example
  .split("\n")
  .map((line) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    return m ? `${m[1]}=${values.get(m[1]!) ?? m[2]}` : line;
  })
  .join("\n");
const extra = [...values.keys()].filter((k) => !new RegExp(`^${k}=`, "m").test(example));
writeFileSync(
  envPath,
  extra.length ? `${out}\n# Your additions\n${extra.map((k) => `${k}=${values.get(k)}`).join("\n")}\n` : out,
  { mode: 0o600 },
);
process.loadEnvFile(envPath);

let db = "skipped";
try {
  const handle = await openDb({
    url: process.env.DATABASE_URL,
    dataDir: path.join(REPO_ROOT, process.env.ADLAB_DATA_DIR || ".adlab", "pglite"),
  });
  await handle.migrate();
  await handle.close();
  db = `${handle.kind}: migrated`;
} catch (err) {
  db = `not migrated (${(err as Error).message}). If the API is running it migrates on start.`;
}

const skills = syncSkills({ check: false });
const summary = {
  ok: true,
  envFile: ".env",
  generated,
  database: db,
  skillsSynced: skills.copied,
  dashboard: `http://localhost:${process.env.ADLAB_WEB_PORT || 5173}`,
  dashboardPassword: process.env.ADLAB_DASHBOARD_PASSWORD,
  next: ["npm run dev", "npm run demo  (in a second terminal)", "npm run adlab -- health"],
};
if (json) console.log(JSON.stringify(summary, null, 2));
else {
  log("\n✔ adlab is set up\n");
  log(
    `  .env           ${generated.length ? `generated ${generated.join(", ")}` : "unchanged (all secrets already set)"}`,
  );
  log(`  database       ${db}`);
  log(`  skills         ${skills.copied} synced to .claude/skills`);
  log(`  dashboard      ${summary.dashboard}`);
  log(`  password       ${summary.dashboardPassword}   (ADLAB_DASHBOARD_PASSWORD in .env)\n`);
  log("  Next:  npm run dev      # API + worker + dashboard");
  log("         npm run demo     # in another terminal: a full simulated test, no spend\n");
}
