import { SYSTEM } from "./config";
import type { Ctx } from "./context";
import { claimJob, enqueue, finishJob } from "./jobs";
import { decideTest, syncTest } from "./measure";
import { lastDigestAt, reconcile, sendDigest } from "./ops";
import { listTests } from "./tests";
import { renderVariant } from "./variants";

/** Run one claimed job. Returns false when the queue is empty. */
export async function runOneJob(ctx: Ctx): Promise<boolean> {
  const job = await claimJob(ctx);
  if (!job) return false;
  const p = job.payload as Record<string, string>;
  try {
    if (job.kind === "render") await renderVariant(ctx, p.variantId!);
    else if (job.kind === "sync") await syncTest(ctx, SYSTEM("worker:sync"), p.testId!);
    else if (job.kind === "decide") await decideTest(ctx, SYSTEM("worker:rules"), p.testId!);
    else if (job.kind === "reconcile") await reconcile(ctx, SYSTEM("worker:reconcile"));
    else if (job.kind === "digest") await sendDigest(ctx, SYSTEM("worker:digest"));
    else throw new Error(`Unknown job kind ${job.kind}`);
    await finishJob(ctx, job);
  } catch (err) {
    await finishJob(ctx, job, err as Error);
  }
  return true;
}

export async function drainJobs(ctx: Ctx, max = 100) {
  let n = 0;
  while (n < max && (await runOneJob(ctx))) n++;
  return n;
}

/** Schedules: sync then decide every running test, reconcile, and the daily digest at 08:00 UTC. */
export async function scheduleTick(ctx: Ctx) {
  const running = await listTests(ctx, { status: "running" });
  for (const t of running) {
    await enqueue(ctx, "sync", { testId: t.id }, { dedupeKey: `sync:${t.id}` });
    await enqueue(
      ctx,
      "decide",
      { testId: t.id },
      { dedupeKey: `decide:${t.id}`, runAt: new Date(Date.now() + 5_000) },
    );
  }
  await enqueue(ctx, "reconcile", {}, { dedupeKey: "reconcile" });
  const now = ctx.now();
  const last = await lastDigestAt(ctx);
  if (now.getUTCHours() >= 8 && (!last || last.slice(0, 10) !== now.toISOString().slice(0, 10))) {
    await enqueue(ctx, "digest", {}, { dedupeKey: "digest" });
  }
}

export interface WorkerHandle {
  stop(): Promise<void>;
}

export function startWorker(
  ctx: Ctx,
  opts: { pollMs?: number; scheduleMs?: number; log?: (m: string) => void } = {},
): WorkerHandle {
  const log = opts.log ?? (() => {});
  let stopped = false;
  let busy: Promise<unknown> = Promise.resolve();
  const poll = setInterval(() => {
    busy = busy.then(async () => {
      if (stopped) return;
      const n = await drainJobs(ctx, 20).catch((e) => (log(`job loop error: ${(e as Error).message}`), 0));
      if (n) log(`ran ${n} job(s)`);
    });
  }, opts.pollMs ?? 1000);
  const schedule = setInterval(
    () => {
      busy = busy.then(() =>
        stopped ? undefined : scheduleTick(ctx).catch((e) => log(`schedule error: ${(e as Error).message}`)),
      );
    },
    opts.scheduleMs ?? 15 * 60_000,
  );
  return {
    async stop() {
      stopped = true;
      clearInterval(poll);
      clearInterval(schedule);
      await busy;
    },
  };
}
