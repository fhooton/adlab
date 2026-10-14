# Infra (OpenTofu)

Status: **scaffold.** The cloud provider is still an open question, so the modules here are
provider-agnostic shapes with the inputs every target needs. Pick a provider, implement
`modules/service` and `modules/database` for it, and wire `envs/{dev,staging,prod}`.

What a hosted deployment needs (same code as local):

| Piece | Notes |
| --- | --- |
| API container | `Dockerfile`, `ADLAB_SERVE_WEB=true` serves the dashboard on the same origin; HTTPS only |
| Worker container | same image, `npx tsx apps/worker/src/main.ts`; needs Chromium + FFmpeg (in the image) |
| Postgres | `DATABASE_URL`; the API migrates on start |
| Object storage | S3-compatible bucket for renders (swap `LocalStorage` for an S3 adapter) |
| Secrets | `ADLAB_API_TOKENS`, `ADLAB_DASHBOARD_PASSWORD`, `ADLAB_SESSION_SECRET`, `META_*` |

Moving from local to hosted is a deploy plus a one-time database migration, not a rewrite.

```bash
tofu fmt -check -recursive
tofu -chdir=envs/dev init -backend=false && tofu -chdir=envs/dev validate
```
