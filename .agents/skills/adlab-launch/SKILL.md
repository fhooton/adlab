---
name: adlab-launch
description: Create an adlab test from rendered variants, run pre-flight, and request launch (stages 6-7). Use when the user wants to put variants live or start a test.
---

# Pre-flight and launch

Two-stage testing: **stage 1** is a cheap attention filter (decides on hook rate; removes duds),
**stage 2** is a conversion test on stage-1 survivors (decides on conversions per impression).

```bash
npm run adlab -- test create --input '{"briefId":"brf_…","stage":1,"variantIds":["var_…"],"budgetCents":24000,"durationHours":72}'
npm run adlab -- test preflight --test-id tst_…
```

`budgetCents` is the platform **lifetime budget**: the worst-case spend, enforced by the platform
even if nothing of ours is running. Confirm the amount with the user. Stage 1: roughly $30–60 per
variant; stage 2 needs ~50 conversions per variant to separate them.

Pre-flight checks policy, specs, duplicates, naming, the budget governor and tracking (a test event
plus the landing page's tag). Fix every `error`; mention `warning`s to the user. Then:

```bash
npm run adlab -- test launch --test-id tst_…   # exit 5: pending approval
```

Stop and tell the user: what will launch, the amount, and that they approve it under Approvals.
After approval the API creates PAUSED objects with lifetime budgets, then activates them.
