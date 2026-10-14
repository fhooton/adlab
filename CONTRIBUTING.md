# Contributing

Thanks for helping. Agents and humans follow the same loop — see [AGENTS.md](AGENTS.md).

1. `npm install && npm run setup`
2. Write the failing test first (`packages/core` changes need tests; coverage floor is 90%).
3. `npm run verify` (fast) while iterating; `npm run verify -- --tier full` before opening a PR.
4. In the PR, say which gates ran and whether any metric moved (backtest recall / wasted spend,
   render time, eval scores). Changing a rule set, policy pack, threshold or baseline? Call it out.

Good first areas: TikTok adapter (`packages/adapters`), more render templates, market policy packs
(`knowledge/policies`), an S3 storage adapter, OpenTofu modules for your cloud.
