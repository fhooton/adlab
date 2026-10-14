---
name: adlab-variants
description: Write structured variant specs for a selected adlab hypothesis and queue renders (stages 4-5). Use when making ad variants, hooks, scripts or copy for adlab.
---

# Variants

A variant is **data, not a file**: a JSON spec naming a render template and filling its variables,
plus ad copy. Same spec in, same video out, so specs can be re-rendered, diffed and traced.

1. `npm run adlab -- template list` — pick a template; respect each variable's `maxLength`.
2. Write one **control** and N variants that each change **exactly one** dimension (a variable or
   a copy field) vs the control. The API rejects anything else. Testing hooks? Change only `hook`.
3. Set `hookType` honestly (`question|bold_claim|problem|social_proof|demo|stat|curiosity|offer|testimonial`).
4. Record provenance in `generator`: `{"skill":"adlab-variants","skillVersion":"0.1.0","model":"<your model id>"}`.

```bash
npm run adlab -- variants create --file variants.json
npm run adlab -- variants render --input '{"variantIds":["var_…","var_…"]}'
npm run adlab -- variants list --brief-id brf_… --status rendered
```

Aim for at least 20 variants per brief across hypotheses. Write copy against
`knowledge/policies/` (pre-flight will block violations anyway) and see
[reference/copy.md](reference/copy.md) for hook and copy guidance. If validation fails (exit 2),
read `error.details`: each entry names the variant and the problem.
