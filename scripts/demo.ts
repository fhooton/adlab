import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AdlabClient } from "@adlab/client";

/**
 * `npm run demo`: one full simulated loop against the running API (fake ad platform, no spend),
 * driven exactly the way an agent drives it — through the API with the agent token.
 * The two human approval steps log in with the dashboard password, clearly labelled "Demo Human".
 * Open the dashboard while it runs to watch it happen.
 */
const root = fileURLToPath(new URL("../", import.meta.url));
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));
const baseUrl = process.env.ADLAB_API_URL || "http://localhost:8787";
const agent = new AdlabClient({ baseUrl, token: process.env.ADLAB_API_TOKEN });
const step = (n: number, text: string) => console.log(`\n\x1b[1m${n}. ${text}\x1b[0m`);
const show = (o: unknown) => console.log(`   ${JSON.stringify(o)}`);

const health = await agent.run("health").catch((e: Error) => {
  console.error(`${e.message}\nStart the stack first:  npm run dev`);
  process.exit(1);
});
if (health.platformMode !== "fake") {
  console.error("The demo only runs against the fake ad platform (ADLAB_PLATFORM=fake).");
  process.exit(1);
}

async function humanClient() {
  const res = await fetch(new URL("/v1/auth/login", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: process.env.ADLAB_DASHBOARD_PASSWORD, name: "Demo Human" }),
  });
  if (!res.ok) throw new Error(`Demo login failed: ${res.status}`);
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  return new AdlabClient({ baseUrl, headers: { cookie, "x-adlab-csrf": "1" } });
}

step(1, "Brief");
const brief = await agent.run("briefCreate", {
  product: "Sprout — 30-minute meal kits",
  productUrl: "https://example.com/sprout",
  audience: "Busy parents of young kids, US",
  offer: "50% off your first box",
  markets: ["US"],
  conversionEvent: "purchase",
  weeklyCapCents: 40_000,
});
show({ id: brief.id, weeklyCap: "$400" });

step(2, "Research note");
await agent.run("researchAdd", {
  briefId: brief.id,
  summary:
    "Competitors running 60+ days lead with time saved and kid-approved meals; price-led ads run short.",
  sources: ["https://www.facebook.com/ads/library/"],
  referenceAds: [
    {
      url: "https://www.facebook.com/ads/library/?id=1",
      advertiser: "Competitor A",
      runDays: 74,
      notes: "Hook: 'Dinner in 30'",
    },
  ],
});

step(3, "Angle matrix — agent proposes, human picks");
const { hypotheses, approval: pick } = await agent.run("hypothesesPropose", {
  briefId: brief.id,
  hypotheses: [
    {
      concept: "time-saved",
      persona: "busy-parent",
      format: "motion_graphic",
      rationale: "Longest-running competitor ads lead with time",
    },
    {
      concept: "picky-eaters",
      persona: "busy-parent",
      format: "motion_graphic",
      rationale: "Reviews mention kids eating veggies",
    },
    { concept: "price", persona: "budget-shopper", format: "static", rationale: "Strong first-box offer" },
  ],
});
const human = await humanClient();
await human.run("approvalDecide", {
  approvalId: pick.id,
  version: pick.version,
  decision: "approve",
  selection: [hypotheses[0].id],
});
show({ selected: hypotheses[0].concept, by: "Demo Human" });

step(4, "Variants — one variable changed per variant (the hook)");
const hooks = [
  "Dinner in 30 minutes. Really.",
  "No more 6pm panic.",
  "Kids actually eat the veggies.",
  "Skip the grocery run.",
  "Cook once. Everyone eats.",
  "Takeout is costing you.",
];
const variants = await agent.run("variantsCreate", {
  hypothesisId: hypotheses[0].id,
  generator: { skill: "adlab-variants", skillVersion: "0.1.0", model: "demo-script" },
  variants: hooks.map((hook, i) => ({
    label: i === 0 ? "control" : `hook: ${hook.slice(0, 24)}`,
    isControl: i === 0,
    templateId: "bold-claim-10s",
    variables: {
      hook,
      stat: "30min",
      statLabel: "from box to table, on average",
      cta: "Get 50% off",
      brand: "Sprout",
    },
    copy: {
      primaryText: "Fresh ingredients, 30-minute recipes, 50% off your first box.",
      headline: "Dinner, sorted",
      cta: "SHOP_NOW",
    },
    hookType: "bold_claim",
    aspectRatios: ["9:16"],
  })),
});
show({ variants: variants.length });

step(5, "Render");
await agent.run("variantsRender", { variantIds: variants.map((v: { id: string }) => v.id) });
for (let i = 0; i < 60; i++) {
  const list = await agent.run("variantsList", { briefId: brief.id });
  if (list.every((v: { status: string }) => v.status === "rendered")) break;
  if (list.some((v: { status: string }) => v.status === "render_failed"))
    throw new Error("A render failed; see API logs");
  await new Promise((r) => setTimeout(r, 1000));
}
show({ rendered: variants.length, renderer: health.renderer });

step(6, "Pre-flight");
const test = await agent.run("testCreate", {
  briefId: brief.id,
  stage: 1,
  variantIds: variants.map((v: { id: string }) => v.id),
  budgetCents: 24_000,
  durationHours: 72,
});
const report = await agent.run("testPreflight", { testId: test.id });
show({
  ok: report.ok,
  checks: report.checks.length,
  warnings: report.checks.filter((c: { ok: boolean }) => !c.ok).map((c: { check: string }) => c.check),
});
if (!report.ok) process.exit(1);

step(7, "Launch — agent requests, human approves $240.00");
const { approval } = await agent.run("testLaunch", { testId: test.id });
await human.run("approvalDecide", {
  approvalId: approval.id,
  version: approval.version,
  decision: "approve",
});
show({ launched: test.id });

for (let day = 1; day <= 3; day++) {
  step(8, `Measure — simulate day ${day} on the fake ad platform`);
  await agent.run("simAdvance", { hours: 24 });
  await agent.run("testSync", { testId: test.id });
  step(9, `Decide (day ${day})`);
  const d = await agent.run("testDecide", { testId: test.id });
  show({
    complete: d.complete,
    autoApplied: d.autoApplied.length,
    pendingApproval: d.pendingApproval.map((p: { action: string }) => p.action),
  });
}

const results = await agent.run("testGet", { testId: test.id });
console.log("\n   Results");
for (const v of results.variants) {
  const pct = (x: number | null) => (x === null ? "  —  " : `${(x * 100).toFixed(1)}%`);
  console.log(
    `   ${v.label.padEnd(32)} hook ${pct(v.rates.hookRate)}  P(best) ${pct(v.probBest)}  ${v.latestDecision?.action ?? "hold"}`,
  );
}

step(10, "Learn");
const best = [...results.variants].sort((a, b) => (b.probBest ?? 0) - (a.probBest ?? 0))[0];
await agent.run("learningAdd", {
  briefId: brief.id,
  statement: `Hook "${best.label}" led stage 1 on hook rate for busy parents (simulated)`,
  evidenceIds: [test.id],
  confidence: "low",
});
console.log(
  `\nDone. Open the dashboard to review approvals, results and the activity log.\nPending decisions are waiting in Approvals.\n`,
);
