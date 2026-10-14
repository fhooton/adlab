import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CreateVariantsInput } from "@adlab/contracts";
import {
  type Actor,
  checkOneVariableRule,
  deriveTags,
  hashOf,
  specHash,
  validateVariables,
} from "@adlab/core";
import {
  assets,
  generationRuns,
  hypotheses,
  metricSnapshots,
  newId,
  ratings,
  templates,
  variants,
} from "@adlab/db";
import { getTemplate, TEMPLATES } from "@adlab/render";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { audit } from "./audit";
import { requireBrief } from "./briefs";
import type { Ctx } from "./context";
import { invalid, notFound } from "./errors";
import { enqueue } from "./jobs";
import { toVariant } from "./mappers";

/** Keep the templates table in sync with the code manifest (templates are versioned in git). */
export async function syncTemplates(ctx: Ctx) {
  for (const t of TEMPLATES) {
    await ctx.db
      .insert(templates)
      .values({
        id: `tpl_${hashOf([t.id, t.version]).slice(0, 12)}`,
        templateKey: t.id,
        name: t.name,
        version: t.version,
        description: t.description,
        format: t.format,
        durationSeconds: t.durationSeconds,
        aspectRatios: t.aspectRatios,
        variableSchema: t.variables,
      })
      .onConflictDoNothing();
  }
}

export function listTemplates() {
  return TEMPLATES;
}

export async function createVariants(ctx: Ctx, actor: Actor, raw: unknown) {
  const input = CreateVariantsInput.parse(raw);
  const [hyp] = await ctx.db.select().from(hypotheses).where(eq(hypotheses.id, input.hypothesisId));
  if (!hyp) throw notFound("Hypothesis", input.hypothesisId);
  if (hyp.status !== "selected" && hyp.status !== "tested") {
    throw invalid(
      `Hypothesis is "${hyp.status}". A human must select it in the dashboard before variants are made.`,
    );
  }
  const brief = await requireBrief(ctx, hyp.briefId);

  const errors: Array<{ index: number; label: string; message: string }> = [];
  input.variants.forEach((spec, index) => {
    const template = getTemplate(spec.templateId);
    if (!template) {
      errors.push({
        index,
        label: spec.label,
        message: `Unknown template ${spec.templateId}. Run \`adlab template list\`.`,
      });
      return;
    }
    for (const message of validateVariables(template, spec.variables))
      errors.push({ index, label: spec.label, message });
    for (const aspect of spec.aspectRatios) {
      if (!template.aspectRatios.includes(aspect))
        errors.push({ index, label: spec.label, message: `Template does not support ${aspect}` });
    }
  });
  errors.push(...checkOneVariableRule(input.variants));

  const hashes = input.variants.map((s) => specHash(s, getTemplate(s.templateId)?.version ?? "?"));
  const existing = await ctx.db
    .select({ specHash: variants.specHash, id: variants.id })
    .from(variants)
    .where(eq(variants.hypothesisId, hyp.id));
  hashes.forEach((h, index) => {
    const dup = existing.find((e) => e.specHash === h);
    if (dup)
      errors.push({
        index,
        label: input.variants[index]!.label,
        message: `Duplicate of existing variant ${dup.id}`,
      });
    if (hashes.indexOf(h) !== index)
      errors.push({
        index,
        label: input.variants[index]!.label,
        message: "Duplicate spec within this request",
      });
  });
  if (errors.length) throw invalid(`${errors.length} problem(s) in variant specs`, errors);

  const runId = newId("gen");
  const now = ctx.now();
  const rows = input.variants.map((spec, i) => {
    const template = getTemplate(spec.templateId)!;
    return {
      id: newId("var"),
      hypothesisId: hyp.id,
      briefId: brief.id,
      label: spec.label,
      isControl: spec.isControl,
      templateId: spec.templateId,
      templateVersion: template.version,
      variables: spec.variables,
      copy: spec.copy,
      hookType: spec.hookType,
      footageSource: spec.footageSource,
      aspectRatios: spec.aspectRatios,
      tags: deriveTags(spec, hyp as never, {
        offer: brief.offer,
        market: brief.markets[0],
        language: brief.languages[0],
      }),
      generator: input.generator,
      generationRunId: runId,
      specHash: hashes[i]!,
      status: "draft",
      createdAt: now,
    };
  });
  await ctx.db.insert(generationRuns).values({
    id: runId,
    kind: "variants",
    skillVersion: `${input.generator.skill}@${input.generator.skillVersion}`,
    model: input.generator.model,
    promptHash: input.generator.promptHash ?? null,
    costCents: 0,
    outputIds: rows.map((r) => r.id),
    createdBy: actor.name,
    createdAt: now,
  });
  const inserted = await ctx.db.insert(variants).values(rows).returning();
  await audit(ctx, actor, "variants.created", "hypothesis", hyp.id, {
    count: inserted.length,
    generationRunId: runId,
  });
  return inserted.map(toVariant);
}

export async function listVariants(
  ctx: Ctx,
  filter: { briefId?: string; hypothesisId?: string; status?: string },
) {
  const where: SQL[] = [];
  if (filter.briefId) where.push(eq(variants.briefId, filter.briefId));
  if (filter.hypothesisId) where.push(eq(variants.hypothesisId, filter.hypothesisId));
  if (filter.status) where.push(eq(variants.status, filter.status));
  const rows = await ctx.db
    .select()
    .from(variants)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(variants.createdAt))
    .limit(500);
  const ids = rows.map((r) => r.id);
  const assetRows = ids.length
    ? await ctx.db.select().from(assets).where(inArray(assets.variantId, ids))
    : [];
  const ratingRows = ids.length
    ? await ctx.db.select().from(ratings).where(inArray(ratings.variantId, ids))
    : [];
  return rows.map((r) => ({
    ...toVariant(r),
    assets: assetRows.filter((a) => a.variantId === r.id).map((a) => toAssetView(ctx, a)),
    avgRating: avg(ratingRows.filter((x) => x.variantId === r.id).map((x) => x.score)),
  }));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function toAssetView(ctx: Ctx, a: typeof assets.$inferSelect) {
  return {
    id: a.id,
    variantId: a.variantId,
    kind: a.kind,
    aspect: a.aspect,
    storageKey: a.storageKey,
    url: ctx.storage.url(a.storageKey),
    hash: a.hash,
    costCents: a.costCents,
    durationSeconds: a.durationSeconds,
    renderer: a.renderer,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function requireVariant(ctx: Ctx, id: string) {
  const [row] = await ctx.db.select().from(variants).where(eq(variants.id, id));
  if (!row) throw notFound("Variant", id);
  return row;
}

export async function getVariant(ctx: Ctx, id: string) {
  const row = await requireVariant(ctx, id);
  const [assetRows, ratingRows, metricRows] = await Promise.all([
    ctx.db.select().from(assets).where(eq(assets.variantId, id)),
    ctx.db.select().from(ratings).where(eq(ratings.variantId, id)),
    ctx.db
      .select()
      .from(metricSnapshots)
      .where(eq(metricSnapshots.variantId, id))
      .orderBy(desc(metricSnapshots.capturedAt))
      .limit(1),
  ]);
  return {
    ...toVariant(row),
    assets: assetRows.map((a) => toAssetView(ctx, a)),
    ratings: ratingRows.map((r) => ({ rater: r.rater, score: r.score, note: r.note })),
    avgRating: avg(ratingRows.map((r) => r.score)),
    latestMetrics: metricRows[0] ?? null,
  };
}

export async function requestRenders(ctx: Ctx, actor: Actor, variantIds: string[]) {
  const rows = await ctx.db.select().from(variants).where(inArray(variants.id, variantIds));
  const missing = variantIds.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) throw notFound("Variant", missing.join(", "));
  const queued = [];
  for (const v of rows) {
    const job = await enqueue(ctx, "render", { variantId: v.id }, { dedupeKey: `render:${v.id}` });
    await ctx.db.update(variants).set({ status: "rendering" }).where(eq(variants.id, v.id));
    queued.push({ variantId: v.id, jobId: job.id, deduped: job.deduped });
  }
  await audit(ctx, actor, "variants.render_requested", "variant", null, { variantIds });
  return { queued };
}

/** Worker job: render every aspect of a variant. Cached by spec hash + aspect across variants. */
export async function renderVariant(ctx: Ctx, variantId: string) {
  const v = await requireVariant(ctx, variantId);
  const out = await mkdtemp(path.join(tmpdir(), "adlab-out-"));
  try {
    for (const aspect of v.aspectRatios as Array<"9:16" | "4:5" | "1:1" | "16:9">) {
      const hash = `${v.specHash}:${aspect}:${ctx.renderer.name}`;
      const [mine] = await ctx.db
        .select()
        .from(assets)
        .where(and(eq(assets.variantId, v.id), eq(assets.hash, hash)));
      if (mine) continue;
      const [cached] = await ctx.db.select().from(assets).where(eq(assets.hash, hash)).limit(1);
      if (cached) {
        await ctx.db
          .insert(assets)
          .values({ ...cached, id: newId("ast"), variantId: v.id, costCents: 0, createdAt: ctx.now() });
        continue;
      }
      const result = await ctx.renderer.render({
        templateId: v.templateId,
        variables: v.variables,
        aspect,
        outBase: path.join(out, aspect.replace(":", "x")),
      });
      const ext = path.extname(result.file);
      const key = `renders/${v.specHash}/${aspect.replace(":", "x")}${ext}`;
      await ctx.storage.put(key, { fromFile: result.file });
      await ctx.db.insert(assets).values({
        id: newId("ast"),
        variantId: v.id,
        kind: result.kind,
        aspect,
        storageKey: key,
        hash,
        costCents: result.costCents,
        durationSeconds: result.durationSeconds,
        renderer: result.renderer,
        createdAt: ctx.now(),
      });
    }
    await ctx.db.update(variants).set({ status: "rendered" }).where(eq(variants.id, v.id));
  } catch (err) {
    await ctx.db.update(variants).set({ status: "render_failed" }).where(eq(variants.id, v.id));
    throw err;
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

export async function addRating(
  ctx: Ctx,
  actor: Actor,
  input: { variantId: string; score: number; note?: string },
) {
  await requireVariant(ctx, input.variantId);
  await ctx.db
    .insert(ratings)
    .values({
      id: newId("rat"),
      variantId: input.variantId,
      rater: actor.name,
      score: input.score,
      note: input.note ?? null,
      createdAt: ctx.now(),
    })
    .onConflictDoUpdate({
      target: [ratings.variantId, ratings.rater],
      set: { score: input.score, note: input.note ?? null },
    });
  await audit(ctx, actor, "variant.rated", "variant", input.variantId, { score: input.score });
  return { ok: true };
}
