# adlab

**Turn a product brief into tested ad variants, and find the cost-effective winners inside a hard budget cap.**

Coding agents (Claude Code, Codex, OpenCode) operate it. A web dashboard is where people review, approve and see results.
The agent is the operator; the app is the system of record — agents generate, propose and explain, while code stores
every decision, enforces budgets and makes kill/promote calls. **Nothing spends money without a human approving it in the dashboard.**

```mermaid
flowchart LR
  A[1 Brief] --> B[2 Research] --> C[3 Angles]:::human --> D[4 Variants] --> E[5 Render]
  E --> F[6 Pre-flight] --> G[7 Launch]:::human --> H[8 Measure] --> I[9 Decide] --> J[10 Learn]
  J -. learnings shape the next round .-> C
  classDef human fill:#fff3e8,stroke:#ff5a1f
```

Runs fully local out of the box — embedded Postgres, a simulated ad platform, no accounts, no spend.

![Stage 1 test results in the adlab dashboard](docs/images/dashboard-test-results.png)

---

## Quick start with a coding agent (recommended)

Paste this into Claude Code, Codex or OpenCode:

```text
Clone https://github.com/fhooton/adlab and cd into it. Read AGENTS.md, then follow the adlab-operate skill: set it up, start it in the background, run the demo, and give me the dashboard URL and where to find the password.
```

Already cloned? Open the repo in your agent and paste:

```text
Read AGENTS.md, then set up adlab, start it in the background and run the demo.
```

Then try:

```text
Create a brief for [your product] and propose an angle matrix.
Write 20 hook variants for the selected angle and render them.
Pre-flight and request a $200 stage-1 test.          (you approve it in the dashboard)
How is the test doing? Explain the decisions.
```

The agent finds its instructions automatically: `AGENTS.md` (Codex, OpenCode) and `CLAUDE.md` → `AGENTS.md` (Claude Code),
plus skills in `.agents/skills/` and `.claude/skills/`.

## Quick start by hand

Needs Node 22.12+.

```bash
git clone https://github.com/fhooton/adlab && cd adlab
npm install
npm run setup     # writes .env with generated secrets, migrates the embedded DB
npm run dev       # API + worker + dashboard on http://localhost:5173
```

In a second terminal, run a full simulated test round (brief → 6 variants → approval → 3 simulated days → decisions):

```bash
npm run demo
```

Log in to the dashboard with any display name and the password `npm run setup` printed (`ADLAB_DASHBOARD_PASSWORD` in `.env`).
Pending decisions from the demo are waiting under **Approvals**.

<details>
<summary>Optional: real video renders</summary>

Without FFmpeg, renders are SVG previews so everything else still works. For MP4s via [HyperFrames](https://github.com/heygen-com/hyperframes):

```bash
brew install ffmpeg        # or apt-get install ffmpeg
```

`ADLAB_RENDERER=auto` (the default) switches to HyperFrames when `ffmpeg` is on your PATH. Headless Chrome downloads on first render.
</details>

<details>
<summary>Optional: real Postgres instead of the embedded one</summary>

```bash
docker compose up -d db
echo 'DATABASE_URL=postgres://adlab:adlab@localhost:5432/adlab' >> .env
npm run dev
```
</details>

---

## What you get

| | |
| --- | --- |
| **One command surface, three ways** | Every capability is declared once and exposed as a CLI (`npm run adlab -- …`), an MCP server (`npm run mcp`) and an HTTP API. JSON output, `--dry-run`, meaningful exit codes. |
| **Variants are data** | A variant is a JSON spec: render template + variables + copy. Each one changes exactly one thing vs a control, so attribution is exact and every render is reproducible. |
| **Two-stage tests** | Stage 1 is a cheap attention filter (hook rate); stage 2 is a conversion test on the survivors. |
| **Honest statistics** | Minimum evidence before any judgment, Bayesian probability-of-best with credible intervals, versioned rule sets, and a decision backtest against a simulator with known winners. |
| **Spend safety** | Platform lifetime budgets cap worst-case spend; a budget governor checks account and brief weekly caps before every launch; a kill switch pauses everything; reconciliation flags manual edits instead of overwriting them. |
| **Traceability** | Registry IDs in every campaign, ad set and ad name and in UTMs. Every decision stores its rule version and an input snapshot. Every write is in the audit log with who did it. |
| **Templates, not one-off videos** | [HyperFrames](https://github.com/heygen-com/hyperframes) templates render 9:16, 4:5 and 1:1 from one spec, with the live template previewed in the dashboard before anything is rendered or spent. |

<p>
  <img src="docs/images/template-problem-solution.jpg" width="49%" alt="problem-solution-15s template key frames">
  <img src="docs/images/template-bold-claim.jpg" width="49%" alt="bold-claim-10s template key frames">
</p>

### Who can do what

| | Agent (API token) | Human (dashboard) |
| --- | --- | --- |
| Create briefs, research, angles, variants, tests | ✓ | ✓ |
| Run pre-flight, request a launch | ✓ | ✓ |
| Pick angles, **approve launches and decisions** | — | ✓ |
| Engage the kill switch | ✓ | ✓ |
| Release the kill switch, rate variants | — | ✓ |

Agent tokens are named (`claude-laptop:…,codex-ci:…`) so the audit log shows which client acted, and one can be revoked without rotating the rest.

## Use with your agent

**CLI** (works in every agent):

```bash
npm run adlab -- commands                    # everything you can do
npm run adlab -- schema "variants create"    # input schema for one command
npm run adlab -- brief list --pretty
```

Exit codes: `0` ok · `2` invalid input · `3` auth · `4` conflict · `5` **waiting for human approval** · `6` not found · `7` blocked by budget, policy or kill switch.

**MCP** (for richer tool schemas, or desktop/chat clients). The server reads `.env`, so no secrets go in the config:

```json
{ "mcpServers": { "adlab": { "command": "node", "args": ["/path/to/adlab/packages/mcp/bin/adlab-mcp.mjs"] } } }
```

With Claude Code, from the repo root: `claude mcp add adlab -- node "$PWD/packages/mcp/bin/adlab-mcp.mjs"`.

**Skills** live in [`.agents/skills`](.agents/skills) (canonical — Codex and OpenCode read it) and are synced to `.claude/skills` for Claude Code:
`adlab-operate`, `adlab-brief`, `adlab-angles`, `adlab-variants`, `adlab-launch`, `adlab-decide`, `adlab-learn`, `adlab-template-author`.

## Going live on Meta

Everything above runs against a simulator. Connecting a real account is deliberately staged:

1. **Shadow mode (read-only).** Set `ADLAB_PLATFORM=meta`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` (plus `META_PIXEL_ID`, `META_PAGE_ID`, `META_TEST_EVENT_CODE`).
   Writes stay blocked; adlab reads insights and proposes decisions while a human acts in Ads Manager. Measure how often its calls match yours.
2. **Supervised live.** Set `ADLAB_ENV=prod` and `ADLAB_ALLOW_LIVE_WRITES=true`, keep a small `ADLAB_WEEKLY_CAP_CENTS`, and use a capped payment card. Every launch and change is approved in the app.
3. **Bounded autonomy.** `ADLAB_AUTO_APPLY=kill` lets the rules engine pause losers on its own. Promote, scale and budget increases always stay with a human.

> The Meta write path is implemented but has not yet been exercised against a live account. Treat step 2 as early-access and start small.

## Configuration

`npm run setup` writes `.env` from [`.env.example`](.env.example); every value has a safe default. The ones you'll touch:

| Variable | Default | |
| --- | --- | --- |
| `ADLAB_WEEKLY_CAP_CENTS` | `50000` | Hard account-wide weekly cap, on top of each brief's cap |
| `ADLAB_PLATFORM` | `fake` | `fake` simulator or `meta` |
| `ADLAB_AUTO_APPLY` | *(empty)* | Actions the rules engine may apply alone: `kill` at most |
| `ADLAB_RENDERER` | `auto` | `auto`, `hyperframes` or `fake` |
| `ADLAB_WEBHOOK_URL` | *(empty)* | POST alerts and the daily digest as JSON (Slack, Telegram, Hermes, email bridges) |
| `DATABASE_URL` | *(empty)* | Real Postgres; empty uses embedded PGlite in `.adlab/` |
| `ADLAB_API_TOKENS` | generated | `name:secret,…` agent tokens |
| `ADLAB_DASHBOARD_PASSWORD` | generated | Shared dashboard password; the login also asks for a display name for the audit log |

## Project layout

```text
AGENTS.md            canonical agent instructions (CLAUDE.md imports it)
.agents/skills/      canonical skills  →  synced to .claude/skills/
apps/
  api/               Hono HTTP API, auth, inline worker for local
  worker/            standalone worker for real Postgres
  web/               React + Tailwind dashboard
packages/
  contracts/         Zod schemas + the command registry
  core/              pure domain logic: rules engine, stats, budget governor, naming, preflight
  db/                Drizzle schema + committed migrations
  adapters/          Meta, storage, tracking check, webhook — behind interfaces
  fixtures/          fake ad platform, scenarios, decision backtest
  render/            HyperFrames templates + renderer
  services/          application layer shared by api and worker
  client/ cli/ mcp/  agent-facing surfaces
  ui/                our component library + tokens (Storybook: npm run storybook)
knowledge/           context, policy packs, learnings (versioned markdown)
infra/               OpenTofu scaffold
```

## Development

```bash
npm run verify                    # fast: typecheck, lint, unit + property tests, boundaries, skills drift
npm run verify -- --tier full     # + integration, API, migrations drift, web build, Storybook, e2e
npm run verify -- --tier nightly  # + decision backtest vs baseline, render goldens, agent conformance, infra
```

The component library (`packages/ui`) has a Storybook with every component in each state, light and dark:

```bash
npm run storybook                 # http://localhost:6006
```

See [AGENTS.md](AGENTS.md) for the development loop and [CONTRIBUTING.md](CONTRIBUTING.md) for PRs.

## Status

MVP: Meta only, local-first.

- [x] Offline core: registry, rules engine, budget governor, fake ad platform, backtest baseline, CLI, MCP, API
- [x] Generation: skills, knowledge, two HyperFrames templates, render pipeline, policy and spec checks
- [x] Dashboard: briefs, angle matrix, variant review with live preview, approvals, results, activity, kill switch; Storybook for the component library
- [ ] Shadow mode against a live Meta account
- [ ] TikTok adapter, fatigue monitor, learnings decay, generator evals
- [ ] Hosted deploy (OpenTofu modules per provider), push alerts to a messaging channel

## License

[MIT](LICENSE)
