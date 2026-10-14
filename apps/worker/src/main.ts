import { existsSync } from "node:fs";
import path from "node:path";
import { createContext, REPO_ROOT, scheduleTick, startWorker } from "@adlab/services";

/**
 * Standalone worker: render, sync, rules and schedules. Use with a real Postgres (DATABASE_URL);
 * with embedded PGlite the API runs the worker in-process instead.
 */
const envFile = path.join(REPO_ROOT, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error(
    "The standalone worker needs DATABASE_URL (embedded PGlite is single-process; `npm run dev` runs the worker inline).",
  );
  process.exit(2);
}
const { ctx, handle } = await createContext();
await scheduleTick(ctx);
const worker = startWorker(ctx, { log: (m) => console.log(`[worker] ${m}`) });
console.log(
  `[worker] started  platform=${ctx.platform.platform}/${ctx.platform.mode}  renderer=${ctx.renderer.name}`,
);
const stop = async () => {
  await worker.stop();
  await handle.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
