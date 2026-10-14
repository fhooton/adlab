import { type Actor, canDecideApprovals } from "@adlab/core";
import { approvals, decisions, hypotheses, tests } from "@adlab/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { audit } from "./audit";
import type { Ctx } from "./context";
import { conflict, forbidden, invalid, notFound } from "./errors";
import { toApproval } from "./mappers";
import { applyDecision } from "./measure";
import { executeLaunch } from "./tests";

export async function listApprovals(ctx: Ctx, status?: string) {
  const rows = await ctx.db
    .select()
    .from(approvals)
    .where(status ? eq(approvals.status, status) : undefined)
    .orderBy(desc(approvals.createdAt))
    .limit(200);
  return rows.map(toApproval);
}

export interface DecideInput {
  approvalId: string;
  version: number;
  decision: "approve" | "decline";
  selection?: string[];
  note?: string;
}

/**
 * Only dashboard sessions decide. Optimistic locking: the update matches on version and pending
 * status, so two people approving at once, or a person and a rule, produce exactly one action.
 */
export async function decideApproval(ctx: Ctx, actor: Actor, input: DecideInput) {
  if (!canDecideApprovals(actor))
    throw forbidden("Approvals require a dashboard session. Agents can request spend, never approve it.");
  const [current] = await ctx.db.select().from(approvals).where(eq(approvals.id, input.approvalId));
  if (!current) throw notFound("Approval", input.approvalId);
  if (current.status !== "pending")
    throw conflict(
      `Approval is already ${current.status}${current.decidedBy ? ` by ${current.decidedBy}` : ""}`,
    );
  if (current.kind === "select_hypotheses" && input.decision === "approve" && !input.selection?.length) {
    throw invalid("Pick at least one hypothesis (selection) to approve");
  }

  const claimed = await ctx.db
    .update(approvals)
    .set({
      status: input.decision === "approve" ? "approved" : "declined",
      decidedBy: actor.name,
      decidedAt: ctx.now(),
      version: current.version + 1,
      resultMessage: input.note ?? null,
    })
    .where(
      and(
        eq(approvals.id, current.id),
        eq(approvals.version, input.version),
        eq(approvals.status, "pending"),
      ),
    )
    .returning();
  if (!claimed[0]) throw conflict("Approval changed since you loaded it; refresh and try again");

  const payload = current.actionPayload as Record<string, unknown>;
  let result = input.decision === "approve" ? "Approved" : "Declined";
  try {
    if (current.kind === "launch_test") {
      const testId = String(payload.testId);
      if (input.decision === "approve") {
        const test = await executeLaunch(ctx, actor, testId);
        result = `Launched: ${test.status}`;
      } else {
        await ctx.db
          .update(tests)
          .set({ status: "ready" })
          .where(and(eq(tests.id, testId), eq(tests.status, "pending_approval")));
      }
    } else if (current.kind === "apply_decisions") {
      const ids = (payload.decisionIds as string[]) ?? [];
      const rows = ids.length ? await ctx.db.select().from(decisions).where(inArray(decisions.id, ids)) : [];
      for (const d of rows) {
        if (input.decision === "approve") await applyDecision(ctx, actor, d);
        else
          await ctx.db
            .update(decisions)
            .set({ status: "rejected", approvedBy: actor.name, version: d.version + 1 })
            .where(eq(decisions.id, d.id));
      }
      result = `${input.decision === "approve" ? "Applied" : "Rejected"} ${rows.length} decision(s)`;
    } else if (current.kind === "select_hypotheses") {
      const ids = (payload.hypothesisIds as string[]) ?? [];
      const keep = new Set(input.decision === "approve" ? (input.selection ?? []) : []);
      for (const id of ids) {
        await ctx.db
          .update(hypotheses)
          .set({ status: keep.has(id) ? "selected" : "rejected", decidedBy: actor.name })
          .where(and(eq(hypotheses.id, id), eq(hypotheses.status, "proposed")));
      }
      result = `Selected ${keep.size} of ${ids.length}`;
    }
    await ctx.db
      .update(approvals)
      .set({ resultMessage: [result, input.note].filter(Boolean).join(" — ") })
      .where(eq(approvals.id, current.id));
  } catch (err) {
    await ctx.db
      .update(approvals)
      .set({ status: "failed", resultMessage: (err as Error).message })
      .where(eq(approvals.id, current.id));
    await audit(ctx, actor, "approval.failed", "approval", current.id, { error: (err as Error).message });
    throw err;
  }
  await audit(ctx, actor, `approval.${input.decision}d`, "approval", current.id, {
    kind: current.kind,
    result,
  });
  const [final] = await ctx.db.select().from(approvals).where(eq(approvals.id, current.id));
  return toApproval(final!);
}
