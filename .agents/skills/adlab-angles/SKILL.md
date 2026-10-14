---
name: adlab-angles
description: Propose an angle matrix (concept × persona × format hypotheses) for an adlab brief (stage 3). Use after research, before any variants.
---

# Angle matrix

A hypothesis is one testable idea: **concept × persona × format**, with a rationale that cites
research or a prior learning. Propose 4–8; vary concepts more than formats.

```bash
npm run adlab -- hypotheses propose --file angles.json
# {"briefId":"brf_…","hypotheses":[{"concept":"time-saved","persona":"busy-parent","format":"motion_graphic","rationale":"Top 3 long-running competitor ads lead with time (research res_…)"}]}
```

Formats: `ugc | motion_graphic | static | demo | testimonial | slideshow`. Keep `concept` and
`persona` short kebab-case slugs: they become tags that learnings are grouped by.

This creates an approval. **Stop here** and ask the user to pick which angles to test in the
dashboard (Approvals). Only `selected` hypotheses accept variants. Check with
`npm run adlab -- hypotheses list --brief-id brf_…`.
