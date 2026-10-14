import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "@adlab/api";
import { AdlabClient } from "@adlab/client";
import { FakeRenderer } from "@adlab/render";
import { createContext, loadConfig, syncTemplates } from "@adlab/services";
import { serve } from "@hono/node-server";

/**
 * Agent conformance (nightly): run core skills headless in each installed agent CLI against an
 * isolated API on the fake platform, then assert on registry state. Same end state in every agent.
 * MVP scope: Claude Code is the supported target; Codex/OpenCode run when installed but are advisory.
 */
const TOKEN = `conformance-${"x".repeat(24)}`;
const PROMPT = [
  "You are operating adlab in this repository. Follow the adlab-operate, adlab-brief and adlab-angles skills in .agents/skills.",
  "The API is already running; do NOT run npm run dev or npm run setup.",
  "1. Create a brief from packages/fixtures/conformance/brief.md exactly (weekly cap 15000 cents).",
  "2. Propose an angle matrix of exactly 4 hypotheses for it.",
  "3. Stop when the CLI reports the approval is pending. Do not try to approve anything.",
].join("\n");

const AGENTS: Record<string, (prompt: string) => string[]> = {
  claude: (p) => [
    "claude",
    "-p",
    p,
    "--allowedTools",
    "Bash(npm run adlab:*) Bash(npx adlab:*) Read Glob Grep",
    "--output-format",
    "text",
  ],
  codex: (p) => ["codex", "exec", "--full-auto", p],
  opencode: (p) => ["opencode", "run", p],
};
const required = new Set(["claude"]);

const has = (bin: string) => spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0;
const results: Array<{ agent: string; ok: boolean; problems: string[] }> = [];

const only = process.env.ADLAB_CONFORMANCE_AGENTS?.split(",");
for (const [agent, argv] of Object.entries(AGENTS)) {
  if (!has(agent) || (only && !only.includes(agent))) continue;
  const dataDir = mkdtempSync(path.join(tmpdir(), `adlab-conf-${agent}-`));
  const config = loadConfig({
    ADLAB_DATA_DIR: dataDir,
    ADLAB_API_TOKENS: `${agent}-conformance:${TOKEN}`,
    ADLAB_PLATFORM: "fake",
    ADLAB_SESSION_SECRET: "c".repeat(40),
  });
  const { ctx, handle } = await createContext({ config, renderer: new FakeRenderer(), persistFake: false });
  await syncTemplates(ctx);
  const server = serve({ fetch: createApp(ctx).fetch, port: 0 });
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as { port: number }).port;
  const apiUrl = `http://localhost:${port}`;
  const [cmd, ...args] = argv(PROMPT);
  console.log(`▸ ${agent}: running headless against ${apiUrl}`);
  const run = spawnSync(cmd!, args, {
    encoding: "utf8",
    timeout: 10 * 60_000,
    env: { ...process.env, ADLAB_API_URL: apiUrl, ADLAB_API_TOKEN: TOKEN },
  });

  const client = new AdlabClient({ baseUrl: apiUrl, token: TOKEN });
  const problems: string[] = [];
  if (run.status !== 0) problems.push(`exited ${run.status}: ${(run.stderr || run.stdout).slice(-400)}`);
  const briefs = await client.run("briefList");
  if (briefs.length !== 1) problems.push(`expected 1 brief, found ${briefs.length}`);
  const brief = briefs[0];
  if (brief && brief.weeklyCapCents !== 15000)
    problems.push(`weekly cap ${brief.weeklyCapCents}, expected 15000`);
  if (brief && !/lumen/i.test(brief.product))
    problems.push(`product "${brief.product}" doesn't match fixture`);
  const hyps = brief ? await client.run("hypothesesList", { briefId: brief.id }) : [];
  if (hyps.length !== 4) problems.push(`expected 4 hypotheses, found ${hyps.length}`);
  const approvals = await client.run("approvalList", {});
  if (approvals.some((a: { status: string }) => a.status !== "pending"))
    problems.push("an approval was decided — agents must not approve");
  if (!approvals.some((a: { kind: string }) => a.kind === "select_hypotheses"))
    problems.push("no select_hypotheses approval");
  results.push({ agent, ok: problems.length === 0, problems });

  server.close();
  await handle.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(JSON.stringify(results, null, 2));
if (results.length === 0) console.log("No agent CLIs installed; nothing to check.");
process.exit(results.some((r) => !r.ok && required.has(r.agent)) ? 1 : 0);
