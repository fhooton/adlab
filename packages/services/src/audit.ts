import type { Actor } from "@adlab/core";
import { auditLog, newId } from "@adlab/db";
import type { Ctx } from "./context";

/** Every write is recorded with its actor (display name or API secret name). */
export async function audit(
  ctx: Ctx,
  actor: Actor,
  action: string,
  targetType: string,
  targetId: string | null,
  detail: Record<string, unknown> = {},
) {
  await ctx.db.insert(auditLog).values({
    id: newId("aud"),
    actor: actor.name,
    actorKind: actor.kind,
    action,
    targetType,
    targetId,
    detail,
    createdAt: ctx.now(),
  });
}

export async function alert(ctx: Ctx, kind: string, message: string, detail: Record<string, unknown> = {}) {
  await audit(ctx, { kind: "system", name: "alerts" }, `alert.${kind}`, "system", null, {
    message,
    ...detail,
  });
  await ctx.notifier.send({ type: "alert", title: `adlab: ${kind}`, text: message, data: detail });
}
