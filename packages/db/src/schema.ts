import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * The experiment registry: every brief linked to its hypotheses, variants, platform objects,
 * metrics, decisions and learnings. Migrations are generated (`npm run db:generate`) and committed.
 */
const id = () => text("id").primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const briefs = pgTable("briefs", {
  id: id(),
  product: text("product").notNull(),
  productUrl: text("product_url").notNull(),
  audience: text("audience").notNull(),
  offer: text("offer").notNull(),
  markets: jsonb("markets").$type<string[]>().notNull(),
  languages: jsonb("languages").$type<string[]>().notNull(),
  platforms: jsonb("platforms").$type<string[]>().notNull(),
  conversionEvent: text("conversion_event").notNull(),
  weeklyCapCents: integer("weekly_cap_cents").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

export const researchNotes = pgTable("research_notes", {
  id: id(),
  briefId: text("brief_id")
    .notNull()
    .references(() => briefs.id),
  summary: text("summary").notNull(),
  sources: jsonb("sources").$type<string[]>().notNull(),
  referenceAds: jsonb("reference_ads").$type<unknown[]>().notNull(),
  createdBy: text("created_by").notNull(),
  capturedAt: createdAt(),
});

export const hypotheses = pgTable(
  "hypotheses",
  {
    id: id(),
    briefId: text("brief_id")
      .notNull()
      .references(() => briefs.id),
    concept: text("concept").notNull(),
    persona: text("persona").notNull(),
    format: text("format").notNull(),
    rationale: text("rationale").notNull(),
    status: text("status").notNull().default("proposed"),
    createdBy: text("created_by").notNull(),
    decidedBy: text("decided_by"),
    createdAt: createdAt(),
  },
  (t) => [index("hypotheses_brief_idx").on(t.briefId)],
);

export const templates = pgTable(
  "templates",
  {
    id: id(),
    templateKey: text("template_key").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    description: text("description").notNull(),
    format: text("format").notNull(),
    durationSeconds: real("duration_seconds").notNull(),
    aspectRatios: jsonb("aspect_ratios").$type<string[]>().notNull(),
    variableSchema: jsonb("variable_schema").$type<unknown[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("templates_key_version_idx").on(t.templateKey, t.version)],
);

export const variants = pgTable(
  "variants",
  {
    id: id(),
    hypothesisId: text("hypothesis_id")
      .notNull()
      .references(() => hypotheses.id),
    briefId: text("brief_id")
      .notNull()
      .references(() => briefs.id),
    label: text("label").notNull(),
    isControl: boolean("is_control").notNull().default(false),
    templateId: text("template_id").notNull(),
    templateVersion: text("template_version").notNull(),
    variables: jsonb("variables").$type<Record<string, string | number | boolean>>().notNull(),
    copy: jsonb("copy").$type<Record<string, string>>().notNull(),
    hookType: text("hook_type").notNull(),
    footageSource: text("footage_source").notNull(),
    aspectRatios: jsonb("aspect_ratios").$type<string[]>().notNull(),
    tags: jsonb("tags").$type<Record<string, string>>().notNull(),
    generator: jsonb("generator").$type<Record<string, string>>().notNull(),
    generationRunId: text("generation_run_id"),
    specHash: text("spec_hash").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: createdAt(),
  },
  (t) => [index("variants_hypothesis_idx").on(t.hypothesisId), index("variants_brief_idx").on(t.briefId)],
);

export const assets = pgTable(
  "assets",
  {
    id: id(),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    kind: text("kind").notNull(),
    aspect: text("aspect").notNull(),
    storageKey: text("storage_key").notNull(),
    hash: text("hash").notNull(),
    costCents: integer("cost_cents").notNull().default(0),
    durationSeconds: real("duration_seconds"),
    renderer: text("renderer").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("assets_variant_aspect_hash_idx").on(t.variantId, t.aspect, t.hash)],
);

export const tests = pgTable("tests", {
  id: id(),
  briefId: text("brief_id")
    .notNull()
    .references(() => briefs.id),
  stage: integer("stage").notNull(),
  platform: text("platform").notNull(),
  structure: text("structure").notNull(),
  status: text("status").notNull().default("draft"),
  budgetCents: integer("budget_cents").notNull(),
  durationHours: integer("duration_hours").notNull(),
  variantIds: jsonb("variant_ids").$type<string[]>().notNull(),
  ruleVersion: text("rule_version").notNull(),
  preflight: jsonb("preflight").$type<unknown>(),
  startedAt: ts("started_at"),
  endedAt: ts("ended_at"),
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

export const platformObjects = pgTable(
  "platform_objects",
  {
    id: id(),
    platform: text("platform").notNull(),
    externalId: text("external_id").notNull(),
    kind: text("kind").notNull(),
    parentId: text("parent_id"),
    variantId: text("variant_id").references(() => variants.id),
    testId: text("test_id")
      .notNull()
      .references(() => tests.id),
    name: text("name").notNull(),
    status: text("status").notNull(),
    budgetCents: integer("budget_cents"),
    idempotencyKey: text("idempotency_key").notNull(),
    lastSeenState: jsonb("last_seen_state").$type<unknown>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("platform_objects_idem_idx").on(t.idempotencyKey),
    uniqueIndex("platform_objects_external_idx").on(t.platform, t.externalId),
    index("platform_objects_test_idx").on(t.testId),
  ],
);

export const metricSnapshots = pgTable(
  "metric_snapshots",
  {
    id: id(),
    platformObjectId: text("platform_object_id")
      .notNull()
      .references(() => platformObjects.id),
    variantId: text("variant_id"),
    testId: text("test_id"),
    impressions: integer("impressions").notNull(),
    spendCents: integer("spend_cents").notNull(),
    views3s: integer("views_3s").notNull(),
    views15s: integer("views_15s").notNull(),
    clicks: integer("clicks").notNull(),
    installs: integer("installs").notNull().default(0),
    conversions: integer("conversions").notNull(),
    frequency: real("frequency"),
    definitionsVersion: text("definitions_version").notNull(),
    raw: jsonb("raw").$type<unknown>().notNull(),
    capturedAt: createdAt(),
  },
  (t) => [index("metric_snapshots_object_idx").on(t.platformObjectId, t.capturedAt)],
);

export const decisions = pgTable(
  "decisions",
  {
    id: id(),
    testId: text("test_id")
      .notNull()
      .references(() => tests.id),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    ruleVersion: text("rule_version").notNull(),
    inputsSnapshot: jsonb("inputs_snapshot").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull(),
    proposedBy: text("proposed_by").notNull(),
    approvedBy: text("approved_by"),
    appliedAt: ts("applied_at"),
    version: integer("version").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("decisions_idem_idx").on(t.idempotencyKey), index("decisions_test_idx").on(t.testId)],
);

export const approvals = pgTable(
  "approvals",
  {
    id: id(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    amountCents: integer("amount_cents"),
    actionPayload: jsonb("action_payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by").notNull(),
    decidedBy: text("decided_by"),
    decidedAt: ts("decided_at"),
    resultMessage: text("result_message"),
    version: integer("version").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("approvals_idem_idx").on(t.idempotencyKey), index("approvals_status_idx").on(t.status)],
);

export const spendLedger = pgTable(
  "spend_ledger",
  {
    id: id(),
    account: text("account").notNull(),
    briefId: text("brief_id").notNull(),
    testId: text("test_id").notNull(),
    weekStart: date("week_start").notNull(),
    committedCents: integer("committed_cents").notNull(),
    actualCents: integer("actual_cents").notNull().default(0),
    updatedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("spend_ledger_test_week_idx").on(t.testId, t.weekStart),
    index("spend_ledger_week_idx").on(t.account, t.weekStart),
  ],
);

export const learnings = pgTable("learnings", {
  id: id(),
  briefId: text("brief_id"),
  statement: text("statement").notNull(),
  evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull(),
  confidence: text("confidence").notNull(),
  tags: jsonb("tags").$type<Record<string, string>>(),
  status: text("status").notNull().default("active"),
  reviewedAt: ts("reviewed_at"),
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

export const ratings = pgTable(
  "ratings",
  {
    id: id(),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    rater: text("rater").notNull(),
    score: integer("score").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ratings_variant_rater_idx").on(t.variantId, t.rater)],
);

export const generationRuns = pgTable("generation_runs", {
  id: id(),
  kind: text("kind").notNull(),
  skillVersion: text("skill_version").notNull(),
  model: text("model").notNull(),
  promptHash: text("prompt_hash"),
  tokens: integer("tokens"),
  costCents: integer("cost_cents").notNull().default(0),
  outputIds: jsonb("output_ids").$type<string[]>().notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actor: text("actor").notNull(),
    actorKind: text("actor_kind").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
);

/** Postgres-backed job queue (no separate queue service). Claimed with FOR UPDATE SKIP LOCKED. */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAt: timestamp("run_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lockedAt: ts("locked_at"),
    lastError: text("last_error"),
    dedupeKey: text("dedupe_key"),
    createdAt: createdAt(),
  },
  (t) => [
    index("jobs_claim_idx").on(t.status, t.runAt),
    uniqueIndex("jobs_dedupe_idx")
      .on(t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null and ${t.status} in ('queued','running')`),
  ],
);

/** Small key/value store for system flags (kill switch, last digest time). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: createdAt(),
});
