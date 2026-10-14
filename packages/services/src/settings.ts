import { settings } from "@adlab/db";
import { eq } from "drizzle-orm";
import type { Ctx } from "./context";

export interface KillSwitchState {
  engaged: boolean;
  reason?: string;
  by?: string;
  at?: string;
}

export async function getSetting<T>(ctx: Ctx, key: string, fallback: T): Promise<T> {
  const [row] = await ctx.db.select().from(settings).where(eq(settings.key, key));
  return row ? (row.value as T) : fallback;
}

export async function setSetting(ctx: Ctx, key: string, value: unknown, by: string) {
  await ctx.db
    .insert(settings)
    .values({ key, value, updatedBy: by, updatedAt: ctx.now() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: by, updatedAt: ctx.now() } });
}

export const getKillSwitch = (ctx: Ctx) =>
  getSetting<KillSwitchState>(ctx, "kill_switch", { engaged: false });
