---
name: adlab-template-author
description: Author a new adlab render template with HyperFrames (occasional, human-reviewed). Use when no existing template fits a concept, e.g. "make a 15s testimonial template with captions".
---

# Authoring a render template

Templates are authored occasionally and rendered at volume. Use the HyperFrames skills if your
agent has them (`npx skills add heygen-com/hyperframes`), and copy an existing template in
`packages/render/templates/` as the starting point.

Contract for an adlab template (`packages/render/templates/<id>/index.html`):
- Declare every variable in `data-composition-variables` on `<html>` with an `id`, `type` and `default`.
- Read values the same way the existing templates do (runtime → `window.__hfVariables` → defaults).
- Use `__W__` / `__H__` for dimensions so one template renders 9:16, 4:5 and 1:1.
- Keep text inside safe zones (top 14%, bottom 22%, sides 8%).
- Register a paused GSAP timeline at `window.__timelines["main"]`; no randomness, no wall-clock time.

Then add its manifest to `TEMPLATES` in `packages/render/src/templates.ts` (variables must match the
HTML — a test enforces it), run `npm test`, and preview it in the dashboard before committing.
**A human reviews the preview before the template is committed.** Bump `version` on every change.
