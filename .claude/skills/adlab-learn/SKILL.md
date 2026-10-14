---
name: adlab-learn
description: Record what a finished adlab test taught us, with evidence and confidence (stage 10). Use after a test ends or during the weekly learnings review.
---

# Learn

Every learning is a claim that could be wrong, linked to the tests behind it.

```bash
npm run adlab -- learning add --input '{"briefId":"brf_…","statement":"Problem-framed hooks beat time-saving claims for busy parents on 9:16","evidenceIds":["tst_…"],"confidence":"low","tags":{"hookType":"problem","persona":"busy-parent"}}'
```

- Compare by **tags** (they come from the spec: hook type, persona, format, template, offer), not impressions of the creative.
- One test = `low` confidence. Raise it only when another test agrees. Contradicted? Say so and propose retiring the old one.
- Write durable, human-readable learnings to `knowledge/learnings/<date>-<slug>.md` too, linking test IDs, so they're reviewed in PRs.
- Next round's angles should cite these learnings.
