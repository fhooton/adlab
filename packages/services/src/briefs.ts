import { BriefInput, ProposeHypothesesInput, ResearchNoteInput } from "@adlab/contracts";
import type { Actor } from "@adlab/core";
import { approvals, briefs, hypotheses, newId, researchNotes, tests } from "@adlab/db";
import { desc, eq } from "drizzle-orm";
import { audit } from "./audit";
import type { Ctx } from "./context";
import { notFound } from "./errors";
import { toApproval, toBrief, toHypothesis, toResearch, toTest } from "./mappers";

export async function createBrief(ctx: Ctx, actor: Actor, raw: unknown) {
  const input = BriefInput.parse(raw);
  const id = newId("brf");
  const [row] = await ctx.db
    .insert(briefs)
    .values({ id, ...input, notes: input.notes ?? null, createdBy: actor.name, createdAt: ctx.now() })
    .returning();
  await audit(ctx, actor, "brief.created", "brief", id, { summary: input.product });
  return toBrief(row!);
}

export async function listBriefs(ctx: Ctx) {
  return (await ctx.db.select().from(briefs).orderBy(desc(briefs.createdAt))).map(toBrief);
}

export async function requireBrief(ctx: Ctx, id: string) {
  const [row] = await ctx.db.select().from(briefs).where(eq(briefs.id, id));
  if (!row) throw notFound("Brief", id);
  return row;
}

export async function getBrief(ctx: Ctx, id: string) {
  const brief = toBrief(await requireBrief(ctx, id));
  const [research, hyps, testRows] = await Promise.all([
    ctx.db
      .select()
      .from(researchNotes)
      .where(eq(researchNotes.briefId, id))
      .orderBy(desc(researchNotes.capturedAt)),
    ctx.db.select().from(hypotheses).where(eq(hypotheses.briefId, id)).orderBy(hypotheses.createdAt),
    ctx.db.select().from(tests).where(eq(tests.briefId, id)).orderBy(desc(tests.createdAt)),
  ]);
  return {
    ...brief,
    research: research.map(toResearch),
    hypotheses: hyps.map(toHypothesis),
    tests: testRows.map(toTest),
  };
}

export async function addResearch(ctx: Ctx, actor: Actor, raw: unknown) {
  const input = ResearchNoteInput.parse(raw);
  await requireBrief(ctx, input.briefId);
  const id = newId("res");
  const [row] = await ctx.db
    .insert(researchNotes)
    .values({ id, ...input, createdBy: actor.name, capturedAt: ctx.now() })
    .returning();
  await audit(ctx, actor, "research.added", "brief", input.briefId, {
    researchId: id,
    sources: input.sources.length,
  });
  return toResearch(row!);
}

/** Stage 3: the agent proposes; a human picks. Creates one approval covering the whole matrix. */
export async function proposeHypotheses(ctx: Ctx, actor: Actor, raw: unknown) {
  const input = ProposeHypothesesInput.parse(raw);
  const brief = await requireBrief(ctx, input.briefId);
  const now = ctx.now();
  const rows = input.hypotheses.map((h) => ({
    id: newId("hyp"),
    briefId: brief.id,
    ...h,
    status: "proposed",
    createdBy: actor.name,
    createdAt: now,
  }));
  const inserted = await ctx.db.insert(hypotheses).values(rows).returning();
  const approvalId = newId("apr");
  const [approval] = await ctx.db
    .insert(approvals)
    .values({
      id: approvalId,
      kind: "select_hypotheses",
      title: `Pick angles to test for ${brief.product}`,
      summary: inserted.map((h) => `• ${h.concept} × ${h.persona} × ${h.format}`).join("\n"),
      amountCents: null,
      actionPayload: { briefId: brief.id, hypothesisIds: inserted.map((h) => h.id) },
      requestedBy: actor.name,
      idempotencyKey: `hyp:${approvalId}`,
      createdAt: now,
    })
    .returning();
  await audit(ctx, actor, "hypotheses.proposed", "brief", brief.id, { count: inserted.length, approvalId });
  return { hypotheses: inserted.map(toHypothesis), approval: toApproval(approval!) };
}

export async function listHypotheses(ctx: Ctx, briefId: string) {
  await requireBrief(ctx, briefId);
  return (
    await ctx.db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.briefId, briefId))
      .orderBy(hypotheses.createdAt)
  ).map(toHypothesis);
}
