import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type BacktestResult, runBacktest } from "./backtest";

/**
 * npm run backtest              → run and compare with the committed baseline (exit 1 on regression)
 * npm run backtest -- --update  → run and overwrite the baseline (flag it in your PR!)
 */
const baselinePath = fileURLToPath(new URL("../baselines/backtest.json", import.meta.url));
const update = process.argv.includes("--update");
const results: Record<string, BacktestResult> = {
  stage1: await runBacktest({ stage: 1, scenarios: 40 }),
  stage2: await runBacktest({ stage: 2, scenarios: 40 }),
};

let baseline: Record<string, BacktestResult> = {};
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {}

const regressions: string[] = [];
for (const [stage, r] of Object.entries(results)) {
  const b = baseline[stage];
  if (r.maxBudgetUtilisation > 1)
    regressions.push(`${stage}: spend exceeded budget (${r.maxBudgetUtilisation})`);
  if (!b) continue;
  if (r.winnerRecall + 1e-9 < b.winnerRecall)
    regressions.push(`${stage}: winner recall ${r.winnerRecall} < baseline ${b.winnerRecall}`);
  if (r.wastedSpendShare > b.wastedSpendShare + 0.02)
    regressions.push(
      `${stage}: wasted spend ${r.wastedSpendShare.toFixed(3)} > baseline ${b.wastedSpendShare.toFixed(3)}`,
    );
}

if (update) writeFileSync(baselinePath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ results, baseline: update ? "updated" : baseline, regressions }, null, 2));
if (regressions.length && !update) process.exit(1);
