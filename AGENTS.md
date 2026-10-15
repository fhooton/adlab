# AGENTS.md

Canonical instructions for coding agents (Claude Code, Codex, OpenCode, …). `CLAUDE.md` imports this file.
There are two jobs an agent does here: **operating** adlab (running ad tests) and **developing** it
(changing the code). Read the section you need.

## Operating adlab

Start with the `adlab-operate` skill (`.agents/skills/adlab-operate/SKILL.md`). Short version:

```bash
npm install && npm run setup -- --json   # once
npm run dev                              # keep running (background)
npm run adlab -- commands                # what you can do
```

- The CLI (`npm run adlab -- …`) and MCP server (`npm run mcp`) are the same commands. JSON out, `--dry-run`, exit codes:
  `0` ok · `1` error · `2` invalid · `3` auth · `4` conflict · `5` **pending human approval — stop and ask** · `6` not found · `7` blocked.
- You can request spend; only a human in the dashboard can approve it. Do not look for ways around this.
- With `ADLAB_PLATFORM=fake` (default) everything is simulated: say so when reporting results.

## Developing adlab

### Layout

| Path | What | May import |
| --- | --- | --- |
| `packages/contracts` | Zod schemas + the **command registry** (one definition → HTTP, CLI, MCP) | zod |
| `packages/core` | Pure domain logic: rules engine, stats, budget governor, naming, preflight | contracts only; **no I/O** |
| `packages/db` | Drizzle schema, migrations, PGlite/Postgres client | |
| `packages/adapters` | Ad platforms (Meta), storage, tracking check, webhook — behind interfaces | core, contracts |
| `packages/fixtures` | Fake ad platform (stateful simulator with known winners), scenarios, backtest | |
| `packages/render` | HyperFrames templates + renderer (real and fake) | |
| `packages/services` | Application layer used by api and worker: db + adapters + core | |
| `packages/client` | Typed HTTP client over the registry (used by cli, mcp, scripts) | contracts |
| `packages/cli`, `packages/mcp` | Agent-facing surfaces, generated from the registry | client, contracts |
| `packages/ui` | Our React component library + tokens, with Storybook | nothing from `@adlab/*` |
| `apps/api` | Hono HTTP API, auth, inline worker for local | services |
| `apps/worker` | Standalone worker (with real Postgres) | services |
| `apps/web` | React + Tailwind dashboard | contracts, ui **only** |

`scripts/check-boundaries.ts` enforces the import rules.

### Adding a capability

1. Add the input schema and a `commands` entry in `packages/contracts/src/commands.ts`.
2. Implement it in `packages/services` (pure logic goes in `packages/core`, tested first).
3. Add the handler in `apps/api/src/app.ts` (typecheck fails until you do). CLI and MCP pick it up automatically.
4. If it spends money: `spend: "requests_approval"` and route it through an approval. If humans only: `humanOnly: true`.

### Database

Edit `packages/db/src/schema.ts`, then `npm run db:generate -- --name <change>`. Commit the generated SQL.
Never hand-edit or hand-run migrations; the API applies them on start.

### Loop for every change

1. Restate the task; write the failing test (or eval case) first.
2. Make the smallest change that passes.
3. `npm run verify` (fast tier) until green.
4. If the UI or API changed: `npm run verify -- --tier full` and click through the dashboard; attach screenshots.
5. Report what changed, which gates ran, and any metric that moved (backtest recall, wasted spend, eval score, cost).
6. After three failed attempts on the same gate, stop and ask.

**Never edit a test, eval threshold, rule set, policy pack, fixture or backtest baseline just to make a gate pass
without flagging it.** Rule sets are versioned: add `stage1-v2`, don't edit `stage1-v1`.
`npm run backtest -- --update` rewrites the baseline — only with the user's agreement, and say so in the PR.

### Conventions

- UI: every `packages/ui` component has stories next to it (`Component.stories.tsx`) covering each state.
  Add or update stories with any component change; `npm run storybook` to view, and the full verify tier renders every story.
- TypeScript strict, ESM, Biome (`npm run format`). Money is integer cents. IDs are `prefix_xxxxxxxxxxxx`.
- Every write goes through `audit()`. Every platform write is idempotent (`ensureObject`).
- Skills: edit `.agents/skills/` (canonical), then `npm run skills:sync`. Keep `SKILL.md` lean; put detail in `reference/`. No agent-specific features in core skills.
