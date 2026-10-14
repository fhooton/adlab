import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { composeHtml, HYPERFRAMES_VERSION, HyperFramesRenderer, hasFfmpeg, TEMPLATES } from "@adlab/render";

/**
 * Render goldens (nightly). For every template × aspect ratio, with sample variables:
 *   1. `hyperframes check` must pass (lint, runtime, layout, contrast) — needs only Chrome.
 *   2. `hyperframes snapshot` captures key frames into .adlab/goldens for review.
 *   3. With FFmpeg installed: a real MP4 render, checked for duration and render time.
 */
const SAMPLE: Record<string, Record<string, string>> = {
  "problem-solution-15s": {
    hook: "Still cooking at 9pm?",
    problem: "Takeout again. Third time this week.",
    solution: "30-minute kits the kids actually eat.",
    offer: "50% off your first box",
    cta: "Get 50% off",
    brand: "Sprout",
  },
  "bold-claim-10s": {
    hook: "Dinner in 30 minutes. Really.",
    stat: "30min",
    statLabel: "from box to table, on average",
    cta: "Get 50% off",
    brand: "Sprout",
  },
};
const RENDER_BUDGET_MS = 120_000;
const hf = ["-y", `hyperframes@${HYPERFRAMES_VERSION}`];
const env = { ...process.env, HYPERFRAMES_SKIP_SKILLS: "1" };
const out = path.resolve(".adlab/goldens");
mkdirSync(out, { recursive: true });
const failures: string[] = [];

for (const t of TEMPLATES) {
  const vars = SAMPLE[t.id];
  if (!vars) {
    failures.push(`${t.id}: no sample variables in scripts/render-golden.ts`);
    continue;
  }
  for (const aspect of t.aspectRatios) {
    const label = `${t.id}@${aspect}`;
    const dir = mkdtempSync(path.join(tmpdir(), "adlab-golden-"));
    writeFileSync(path.join(dir, "index.html"), composeHtml(t.id, aspect, vars));
    const check = spawnSync("npx", [...hf, "check", dir, "--json"], { encoding: "utf8", env });
    const report = JSON.parse(check.stdout.slice(check.stdout.indexOf("{")) || "{}") as { ok?: boolean };
    if (!report.ok) failures.push(`${label}: hyperframes check failed`);
    spawnSync(
      "npx",
      [...hf, "snapshot", dir, "--frames", "4", "-o", path.join(out, label.replace(":", "x"))],
      { env },
    );
    if (hasFfmpeg()) {
      const started = Date.now();
      try {
        const r = await new HyperFramesRenderer().render({
          templateId: t.id,
          variables: vars,
          aspect,
          outBase: path.join(out, label.replace(":", "x")),
        });
        const probe = spawnSync(
          "ffprobe",
          ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", r.file],
          { encoding: "utf8" },
        );
        const duration = Number(probe.stdout.trim());
        if (Math.abs(duration - t.durationSeconds) > 0.5)
          failures.push(`${label}: duration ${duration}s, expected ${t.durationSeconds}s`);
        if (Date.now() - started > RENDER_BUDGET_MS)
          failures.push(`${label}: render took ${Date.now() - started}ms (budget ${RENDER_BUDGET_MS}ms)`);
        console.log(
          `${label}: rendered in ${((Date.now() - started) / 1000).toFixed(1)}s, ${duration}s long`,
        );
      } catch (err) {
        failures.push(`${label}: render failed: ${(err as Error).message.slice(0, 300)}`);
      }
    }
    rmSync(dir, { recursive: true, force: true });
    console.log(`${label}: check ${report.ok ? "ok" : "FAILED"}`);
  }
}
console.log(`Key frames in ${out}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
