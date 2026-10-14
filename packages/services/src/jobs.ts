import { jobs, newId } from "@adlab/db";
import { and, eq, sql } from "drizzle-orm";
import type { Ctx } from "./context";

export type JobKind = "render" | "sync" | "decide" | "reconcile" | "digest";

/** Enqueue a job. With a dedupe key, a second enqueue while one is queued/running is a no-op. */
export async function enqueue(
  ctx: Ctx,
  kind: JobKind,
  payload: Record<string, unknown>,
  opts: { dedupeKey?: string; runAt?: Date } = {},
) {
  if (opts.dedupeKey) {
    const existing = await ctx.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.dedupeKey, opts.dedupeKey), sql`${jobs.status} in ('queued','running')`))
      .limit(1);
    if (existing[0]) return { id: existing[0].id, deduped: true };
  }
  const id = newId("job");
  await ctx.db
    .insert(jobs)
    .values({ id, kind, payload, dedupeKey: opts.dedupeKey ?? null, runAt: opts.runAt ?? new Date() });
  return { id, deduped: false };
}

type JobRow = typeof jobs.$inferSelect;

function rowsOf(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  return ((res as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];
}

/** Claim one due job with FOR UPDATE SKIP LOCKED, so several workers never take the same job. */
export async function claimJob(ctx: Ctx): Promise<JobRow | null> {
  const res = await ctx.db.execute(sql`
    update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
    where id = (
      select id from jobs where status = 'queued' and run_at <= now()
      order by run_at limit 1 for update skip locked
    )
    returning id`);
  const row = rowsOf(res)[0];
  if (!row) return null;
  const [job] = await ctx.db
    .select()
    .from(jobs)
    .where(eq(jobs.id, String(row.id)));
  return job ?? null;
}

export async function finishJob(ctx: Ctx, job: JobRow, error?: Error) {
  if (!error) {
    await ctx.db.update(jobs).set({ status: "done", lastError: null }).where(eq(jobs.id, job.id));
    return;
  }
  const retry = job.attempts < job.maxAttempts;
  await ctx.db
    .update(jobs)
    .set({
      status: retry ? "queued" : "failed",
      lastError: error.message.slice(0, 4000),
      // Exponential backoff: 30s, 2m, 8m…
      runAt: retry ? new Date(Date.now() + 30_000 * 4 ** (job.attempts - 1)) : job.runAt,
    })
    .where(eq(jobs.id, job.id));
}
