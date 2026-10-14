---
name: adlab-operate
description: Operate the adlab ad-testing pipeline from a coding agent. Use whenever the user asks to set up adlab, run a test round, check results, or anything involving briefs, variants, ad tests, approvals or the kill switch.
---

# Operating adlab

The app is the system of record; you are the operator. You generate, propose and explain. Code
stores decisions, enforces budgets and makes kill/promote calls. **Humans approve anything that
spends money — you cannot, and must never try to work around that.**

## Setup (once)

```bash
npm install && npm run setup -- --json   # writes .env with secrets, migrates the DB
npm run dev                              # run in the background: API + worker + dashboard
npm run adlab -- health                  # {"ok":true,...}
```

Tell the user the dashboard URL and that the password is `ADLAB_DASHBOARD_PASSWORD` in `.env`
(don't print it unless asked).

## The command surface

`npm run adlab -- <group> <action> [flags]` (or `npx adlab`). JSON on stdout, always.

- `npm run adlab -- commands` lists every command; `npm run adlab -- schema "variants create"` prints an input schema.
- Pass complex input with `--input '<json>'` or `--file path.json` (`--file -` for stdin). Simple fields also work as flags (`--brief-id brf_…`).
- `--dry-run` validates locally and prints the request without sending it.
- Exit codes: `0` ok · `2` invalid input (read `error.details`, fix, retry) · `3` auth · `4` conflict (someone acted first; re-read state) · `5` **pending human approval — stop and ask the user to approve in the dashboard** · `6` not found · `7` blocked by budget, policy or kill switch (explain; don't retry blindly).

An MCP server exposes the same commands (`npm run mcp`); use whichever your client prefers.

## The loop

| Stage | Skill | Command(s) | Gate |
| --- | --- | --- | --- |
| 1 Brief | adlab-brief | `brief create` | required fields |
| 2 Research | adlab-brief | `research add` | sources recorded |
| 3 Angles | adlab-angles | `hypotheses propose` | **human picks** (exit 5 / approval) |
| 4 Variants | adlab-variants | `variants create` | schema valid, one variable changed |
| 5 Render | adlab-variants | `variants render` | render succeeded |
| 6 Pre-flight | adlab-launch | `test create`, `test preflight` | all checks pass |
| 7 Launch | adlab-launch | `test launch` | **human approves** |
| 8 Measure | adlab-decide | `test sync` (worker also runs it) | fresh sync |
| 9 Decide | adlab-decide | `test decide` | only allowed actions auto-apply |
| 10 Learn | adlab-learn | `learning add` | reviewed weekly |

## Rules you must follow

- Never edit `.env` caps, rule sets, policy packs, tests, eval thresholds or fixtures to get past a gate without flagging it to the user.
- If something spends money or is irreversible, it goes through an approval. If you see exit code 5, stop and tell the user what to approve and why.
- Engage the kill switch (`killswitch engage --reason "…"`) immediately if spend looks wrong. Only a human can release it.
- After three failed attempts on the same gate, stop and ask rather than weakening anything.
- With `ADLAB_PLATFORM=fake`, `sim advance --hours N` moves simulated time. Say clearly that results are simulated.
