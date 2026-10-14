import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One verify command, three tiers:
 *   fast    (every change)  typecheck, lint, unit + invariants (core coverage floor), boundaries, skills drift
 *   full    (before merge)  fast + integration + api + migrations drift + web build + e2e (if browsers installed)
 *   nightly                 full + decision backtest vs baseline + render goldens + conformance + infra
 * `--json` prints a machine-readable summary.
 */
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const tier = (args[args.indexOf("--tier") + 1] as "fast" | "full" | "nightly" | undefined) ?? "fast";
const json = args.includes("--json");
if (!["fast", "full", "nightly"].includes(tier)) {
  console.error("--tier must be fast, full or nightly");
  process.exit(2);
}

interface Gate {
  name: string;
  cmd: string[];
  skip?: () => string | null;
  tiers: Array<"fast" | "full" | "nightly">;
  before?: () => void;
}

const has = (bin: string) => spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0;
const migrationsDir = path.join(root, "packages/db/migrations");
const sqlFiles = () => readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

const gates: Gate[] = [
  { name: "typecheck", cmd: ["npx", "tsc", "-p", "tsconfig.json"], tiers: ["fast", "full", "nightly"] },
  { name: "lint+format", cmd: ["npx", "biome", "check", "."], tiers: ["fast", "full", "nightly"] },
  {
    name: "boundaries",
    cmd: ["npx", "tsx", "scripts/check-boundaries.ts"],
    tiers: ["fast", "full", "nightly"],
  },
  {
    name: "skills drift",
    cmd: ["npx", "tsx", "scripts/sync-skills.ts", "--check"],
    tiers: ["fast", "full", "nightly"],
  },
  {
    name: "unit + invariants (core ≥90%)",
    cmd: ["npx", "vitest", "run", "packages/core", "packages/render", "--coverage"],
    tiers: ["fast"],
  },
  {
    name: "all tests (unit, integration, api)",
    cmd: ["npx", "vitest", "run", "--coverage"],
    tiers: ["full", "nightly"],
  },
  {
    name: "migrations drift",
    // Generating from the schema must produce nothing new; if it does, schema and migrations disagree.
    cmd: [
      "sh",
      "-c",
      `before=$(ls ${migrationsDir}/*.sql | wc -l); npx drizzle-kit generate --config packages/db/drizzle.config.ts --name drift_check >/dev/null; after=$(ls ${migrationsDir}/*.sql | wc -l); [ "$before" = "$after" ] || { echo "schema.ts changed without a migration: run npm run db:generate"; exit 1; }`,
    ],
    tiers: ["full", "nightly"],
    before: () => void sqlFiles(),
  },
  {
    name: "web build",
    cmd: ["npm", "run", "-s", "build", "-w", "@adlab/web"],
    tiers: ["full", "nightly"],
    skip: () => (existsSync(path.join(root, "apps/web/index.html")) ? null : "apps/web not built yet"),
  },
  {
    name: "e2e (playwright)",
    cmd: ["npx", "playwright", "test"],
    tiers: ["full", "nightly"],
    skip: () =>
      existsSync(path.join(root, "playwright.config.ts"))
        ? process.env.CI ||
          existsSync(path.join(process.env.HOME ?? "", "Library/Caches/ms-playwright")) ||
          existsSync(path.join(process.env.HOME ?? "", ".cache/ms-playwright"))
          ? null
          : "browsers not installed (npx playwright install chromium)"
        : "no playwright config",
  },
  {
    name: "decision backtest vs baseline",
    cmd: ["npx", "tsx", "packages/fixtures/src/backtest-cli.ts"],
    tiers: ["nightly"],
  },
  {
    name: "render goldens (hyperframes)",
    cmd: ["npx", "tsx", "scripts/render-golden.ts"],
    tiers: ["nightly"],
    skip: () => (has("ffmpeg") ? null : "ffmpeg not installed"),
  },
  {
    name: "agent conformance",
    cmd: ["npx", "tsx", "scripts/conformance.ts"],
    tiers: ["nightly"],
    skip: () => (has("claude") || has("codex") || has("opencode") ? null : "no agent CLI installed"),
  },
  {
    name: "infra (tofu fmt/validate)",
    cmd: [
      "sh",
      "-c",
      "cd infra && tofu fmt -check -recursive && tofu -chdir=envs/dev init -backend=false >/dev/null && tofu -chdir=envs/dev validate",
    ],
    tiers: ["nightly"],
    skip: () => (has("tofu") ? null : "OpenTofu not installed"),
  },
];

const results: Array<{ gate: string; status: "pass" | "fail" | "skip"; ms: number; note?: string }> = [];
for (const g of gates.filter((x) => x.tiers.includes(tier))) {
  const reason = g.skip?.();
  if (reason) {
    results.push({ gate: g.name, status: "skip", ms: 0, note: reason });
    continue;
  }
  if (!json) process.stdout.write(`▸ ${g.name} … `);
  const started = Date.now();
  const r = spawnSync(g.cmd[0]!, g.cmd.slice(1), {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const ok = r.status === 0;
  if (g.name === "migrations drift") {
    for (const f of readdirSync(migrationsDir).filter((f) => f.includes("drift_check")))
      rmSync(path.join(migrationsDir, f));
    spawnSync("git", ["checkout", "--", "packages/db/migrations/meta"], { cwd: root });
  }
  const tail = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-25).join("\n");
  results.push({
    gate: g.name,
    status: ok ? "pass" : "fail",
    ms: Date.now() - started,
    note: ok ? undefined : tail,
  });
  if (!json) console.log(ok ? `pass (${((Date.now() - started) / 1000).toFixed(1)}s)` : `FAIL\n${tail}\n`);
}

const failed = results.filter((r) => r.status === "fail");
if (json) console.log(JSON.stringify({ tier, ok: failed.length === 0, results }, null, 2));
else {
  for (const s of results.filter((r) => r.status === "skip")) console.log(`- ${s.gate}: skipped (${s.note})`);
  console.log(
    failed.length
      ? `\n✖ verify --tier ${tier}: ${failed.length} gate(s) failed`
      : `\n✔ verify --tier ${tier}: all gates passed`,
  );
}
process.exit(failed.length ? 1 : 0);
