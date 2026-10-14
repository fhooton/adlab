# Policy packs

One markdown file per platform and market, named `<platform>-<scope>.md` (for example `meta-core.md`, `meta-de.md`).
Pre-flight loads every file here except this README. A rule is any line of the form:

```
- `rule-id` [error|warning] /regex/flags — message
```

`error` blocks launch; `warning` is shown but allowed. Add market packs (local rules, language variants,
AI-content disclosure requirements) as separate files so they can be reviewed independently.
