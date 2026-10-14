---
name: adlab-decide
description: Sync metrics, run the adlab rules engine and explain results honestly (stages 8-9). Use when checking how a test is doing or deciding kill/hold/promote/scale.
---

# Measure and decide

The worker syncs and decides on a schedule. To do it now:

```bash
npm run adlab -- test sync --test-id tst_…
npm run adlab -- test decide --test-id tst_…
npm run adlab -- test get --test-id tst_… --pretty
```

The **rules engine decides, not you.** It uses minimum evidence (no peeking) and Bayesian
probability-of-best with credible intervals, versioned per stage (`stage1-v1`, `stage2-v1` in
`packages/core/src/rules.ts`). Only actions in `ADLAB_AUTO_APPLY` (at most `kill`) apply
automatically; promote and scale always go to a human.

When you report results:
- Lead with spend vs budget, then each variant's primary metric with its interval and P(best).
- Say "need more data" when `enoughEvidence` is false. Never call a winner the engine hasn't.
- Explain *why* (the decision's `reason`), and what is waiting for approval.
- If results look wrong (spend with no impressions, metrics frozen), run `reconcile run` and
  `tracking check`, and say so.
