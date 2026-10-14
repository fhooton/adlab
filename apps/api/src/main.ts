import { existsSync } from "node:fs";
import path from "node:path";
import { createContext, REPO_ROOT, startWorker, syncTemplates } from "@adlab/services";
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const envFile = path.join(REPO_ROOT, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { ctx, handle } = await createContext();
await syncTemplates(ctx);

// Embedded Postgres (PGlite) is single-process, so the worker runs inside the API process.
// With DATABASE_URL set you can run `npm run start:worker` separately and set ADLAB_INLINE_WORKER=false.
const inlineWorker = handle.kind === "pglite" || process.env.ADLAB_INLINE_WORKER !== "false";
const worker = inlineWorker ? startWorker(ctx, { log: (m) => console.log(`[worker] ${m}`) }) : null;

const webDist = path.join(REPO_ROOT, "apps/web/dist");
const app = createApp(ctx, {
  webDist: process.env.ADLAB_SERVE_WEB === "true" && existsSync(webDist) ? webDist : undefined,
});
const server = serve({ fetch: app.fetch, port: ctx.config.apiPort }, (info) => {
  console.log(
    `[api] http://localhost:${info.port}  db=${handle.kind}  platform=${ctx.platform.platform}/${ctx.platform.mode}  renderer=${ctx.renderer.name}  worker=${inlineWorker ? "inline" : "separate"}`,
  );
});

const shutdown = async () => {
  server.close();
  await worker?.stop();
  await handle.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
