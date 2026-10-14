import { z } from "zod";

/**
 * Domain schemas shared by web, api, worker, cli and mcp.
 * Money is always integer minor units (cents) to avoid float drift in the budget governor.
 */

export const Id = z.string().min(3).max(64);
export const Cents = z.number().int().nonnegative();
export const IsoDate = z.string().datetime({ offset: true });

export const Platform = z.enum(["meta", "tiktok"]);
export type Platform = z.infer<typeof Platform>;

export const AspectRatio = z.enum(["9:16", "4:5", "1:1", "16:9"]);
export type AspectRatio = z.infer<typeof AspectRatio>;

export const ConversionEvent = z.enum(["purchase", "lead", "install", "signup", "add_to_cart"]);

// ---------------------------------------------------------------------------
// Tag taxonomy. Tags come from the variant spec, never from inference, so
// learnings can be attributed exactly. Extend here, not in free text.
// ---------------------------------------------------------------------------
export const HookType = z.enum([
  "question",
  "bold_claim",
  "problem",
  "social_proof",
  "demo",
  "stat",
  "curiosity",
  "offer",
  "testimonial",
]);
export const Format = z.enum(["ugc", "motion_graphic", "static", "demo", "testimonial", "slideshow"]);
export const FootageSource = z.enum(["none", "generated", "stock", "creator", "owned"]);

export const Tags = z
  .object({
    concept: z.string().min(1),
    persona: z.string().min(1),
    format: Format,
    hookType: HookType,
    offer: z.string().min(1),
    template: z.string().min(1),
    footageSource: FootageSource,
    market: z.string().min(2).optional(),
    language: z.string().min(2).optional(),
  })
  .strict();
export type Tags = z.infer<typeof Tags>;

// ---------------------------------------------------------------------------
// Stage 1: Brief
// ---------------------------------------------------------------------------
export const BriefInput = z
  .object({
    product: z.string().min(2).describe("What is being marketed, in one line"),
    productUrl: z.string().url().describe("Landing page the ads send traffic to"),
    audience: z.string().min(2).describe("Who it is for"),
    offer: z.string().min(2).describe("The offer or hook, e.g. '20% off first order'"),
    markets: z.array(z.string().min(2)).min(1).describe("ISO country codes, e.g. ['US']"),
    languages: z.array(z.string().min(2)).min(1).default(["en"]),
    platforms: z.array(Platform).min(1).default(["meta"]),
    conversionEvent: ConversionEvent,
    weeklyCapCents: Cents.describe("Hard weekly spend cap for this brief, in cents"),
    notes: z.string().optional(),
  })
  .strict();
export type BriefInput = z.infer<typeof BriefInput>;

export const Brief = BriefInput.extend({
  id: Id,
  status: z.enum(["active", "archived"]),
  createdAt: IsoDate,
  createdBy: z.string(),
});
export type Brief = z.infer<typeof Brief>;

// ---------------------------------------------------------------------------
// Stage 2: Research
// ---------------------------------------------------------------------------
export const ReferenceAd = z.object({
  url: z.string().url(),
  advertiser: z.string(),
  firstSeen: z.string().optional(),
  runDays: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("How long it has run; long runs imply it works"),
  notes: z.string().optional(),
});

export const ResearchNoteInput = z
  .object({
    briefId: Id,
    summary: z.string().min(10),
    sources: z.array(z.string().url()).min(1, "Record at least one source"),
    referenceAds: z.array(ReferenceAd).default([]),
  })
  .strict();
export type ResearchNoteInput = z.infer<typeof ResearchNoteInput>;

export const ResearchNote = ResearchNoteInput.extend({ id: Id, capturedAt: IsoDate, createdBy: z.string() });
export type ResearchNote = z.infer<typeof ResearchNote>;

// ---------------------------------------------------------------------------
// Stage 3: Angle matrix (hypotheses)
// ---------------------------------------------------------------------------
export const HypothesisStatus = z.enum(["proposed", "selected", "rejected", "tested", "won", "lost"]);

export const HypothesisDraft = z
  .object({
    concept: z.string().min(2),
    persona: z.string().min(2),
    format: Format,
    rationale: z.string().min(5).describe("Why we believe this could win; cite research or learnings"),
  })
  .strict();

export const ProposeHypothesesInput = z
  .object({ briefId: Id, hypotheses: z.array(HypothesisDraft).min(1).max(50) })
  .strict();

export const Hypothesis = HypothesisDraft.extend({
  id: Id,
  briefId: Id,
  status: HypothesisStatus,
  createdAt: IsoDate,
  createdBy: z.string(),
  decidedBy: z.string().nullable(),
});
export type Hypothesis = z.infer<typeof Hypothesis>;

// ---------------------------------------------------------------------------
// Templates (render)
// ---------------------------------------------------------------------------
export const TemplateVariable = z.object({
  id: z.string(),
  type: z.enum(["string", "number", "boolean", "color", "url"]),
  label: z.string(),
  maxLength: z.number().int().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const Template = z.object({
  id: Id,
  name: z.string(),
  version: z.string(),
  description: z.string(),
  format: Format,
  durationSeconds: z.number().positive(),
  aspectRatios: z.array(AspectRatio).min(1),
  variables: z.array(TemplateVariable),
});
export type Template = z.infer<typeof Template>;

// ---------------------------------------------------------------------------
// Stage 4: Variants — data, not files.
// ---------------------------------------------------------------------------
export const AdCopy = z
  .object({
    primaryText: z.string().min(1).max(2200),
    headline: z.string().min(1).max(255),
    description: z.string().max(255).optional(),
    cta: z.enum([
      "LEARN_MORE",
      "SHOP_NOW",
      "SIGN_UP",
      "DOWNLOAD",
      "GET_OFFER",
      "SUBSCRIBE",
      "INSTALL_MOBILE_APP",
    ]),
  })
  .strict();
export type AdCopy = z.infer<typeof AdCopy>;

export const VariableValues = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
export type VariableValues = z.infer<typeof VariableValues>;

export const GeneratorInfo = z
  .object({
    skill: z.string().describe("Skill name that produced the variant, e.g. adlab-variants"),
    skillVersion: z.string(),
    model: z.string().describe("Model id, e.g. claude-opus-5-5"),
    promptHash: z.string().optional(),
  })
  .strict();
export type GeneratorInfo = z.infer<typeof GeneratorInfo>;

export const VariantSpec = z
  .object({
    label: z.string().min(1).max(60).describe("Short human label, e.g. 'hook: question'"),
    isControl: z.boolean().default(false),
    templateId: Id,
    variables: VariableValues,
    copy: AdCopy,
    hookType: HookType,
    footageSource: FootageSource.default("none"),
    aspectRatios: z.array(AspectRatio).min(1).default(["9:16"]),
  })
  .strict();
export type VariantSpec = z.infer<typeof VariantSpec>;

export const CreateVariantsInput = z
  .object({
    hypothesisId: Id,
    generator: GeneratorInfo,
    variants: z.array(VariantSpec).min(1).max(40),
  })
  .strict();
export type CreateVariantsInput = z.infer<typeof CreateVariantsInput>;

export const VariantStatus = z.enum([
  "draft",
  "rendering",
  "rendered",
  "render_failed",
  "ready",
  "live",
  "killed",
  "won",
]);

export const Variant = VariantSpec.extend({
  id: Id,
  hypothesisId: Id,
  briefId: Id,
  templateVersion: z.string(),
  tags: Tags,
  generator: GeneratorInfo,
  specHash: z.string(),
  status: VariantStatus,
  createdAt: IsoDate,
});
export type Variant = z.infer<typeof Variant>;

export const Asset = z.object({
  id: Id,
  variantId: Id,
  kind: z.enum(["video", "image", "footage", "audio"]),
  aspect: AspectRatio,
  storageKey: z.string(),
  url: z.string(),
  hash: z.string(),
  costCents: Cents,
  durationSeconds: z.number().nullable(),
  createdAt: IsoDate,
});
export type Asset = z.infer<typeof Asset>;

// ---------------------------------------------------------------------------
// Stage 6-7: Tests
// ---------------------------------------------------------------------------
export const TestStage = z.union([z.literal(1), z.literal(2)]);
export const TestStatus = z.enum([
  "draft",
  "preflight_failed",
  "ready",
  "pending_approval",
  "launching",
  "running",
  "paused",
  "ended",
]);

export const CreateTestInput = z
  .object({
    briefId: Id,
    stage: TestStage.describe("1 = cheap attention filter, 2 = conversion test"),
    variantIds: z.array(Id).min(2).max(20),
    budgetCents: Cents.min(100).describe("Platform lifetime budget for the whole test. Worst-case spend."),
    durationHours: z
      .number()
      .int()
      .min(24)
      .max(24 * 14)
      .default(72),
    platform: Platform.default("meta"),
  })
  .strict();
export type CreateTestInput = z.infer<typeof CreateTestInput>;

export const Test = z.object({
  id: Id,
  briefId: Id,
  stage: TestStage,
  platform: Platform,
  structure: z.string(),
  status: TestStatus,
  budgetCents: Cents,
  durationHours: z.number().int(),
  variantIds: z.array(Id),
  ruleVersion: z.string(),
  startedAt: IsoDate.nullable(),
  endedAt: IsoDate.nullable(),
  createdAt: IsoDate,
});
export type Test = z.infer<typeof Test>;

export const CheckResult = z.object({
  check: z.string(),
  ok: z.boolean(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  variantId: Id.optional(),
});
export type CheckResult = z.infer<typeof CheckResult>;

export const PreflightReport = z.object({
  testId: Id,
  ok: z.boolean(),
  checks: z.array(CheckResult),
  ranAt: IsoDate,
});
export type PreflightReport = z.infer<typeof PreflightReport>;

// ---------------------------------------------------------------------------
// Stage 8: Measure
// ---------------------------------------------------------------------------
export const NormalizedMetrics = z.object({
  impressions: z.number().int().nonnegative(),
  spendCents: Cents,
  views3s: z.number().int().nonnegative(),
  views15s: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  frequency: z.number().nonnegative().optional(),
});
export type NormalizedMetrics = z.infer<typeof NormalizedMetrics>;

export const MetricSnapshot = NormalizedMetrics.extend({
  id: Id,
  platformObjectId: Id,
  variantId: Id.nullable(),
  testId: Id.nullable(),
  definitionsVersion: z.string(),
  capturedAt: IsoDate,
});
export type MetricSnapshot = z.infer<typeof MetricSnapshot>;

// ---------------------------------------------------------------------------
// Stage 9: Decide
// ---------------------------------------------------------------------------
export const DecisionAction = z.enum(["kill", "hold", "promote", "scale"]);
export type DecisionAction = z.infer<typeof DecisionAction>;

export const Decision = z.object({
  id: Id,
  testId: Id,
  variantId: Id,
  action: DecisionAction,
  reason: z.string(),
  ruleVersion: z.string(),
  inputsSnapshot: z.record(z.string(), z.unknown()),
  status: z.enum(["proposed", "pending_approval", "applied", "rejected", "superseded"]),
  proposedBy: z.string(),
  approvedBy: z.string().nullable(),
  appliedAt: IsoDate.nullable(),
  version: z.number().int(),
  createdAt: IsoDate,
});
export type Decision = z.infer<typeof Decision>;

// ---------------------------------------------------------------------------
// Approvals — agents request, only dashboard sessions decide.
// ---------------------------------------------------------------------------
export const ApprovalKind = z.enum(["launch_test", "apply_decisions", "select_hypotheses"]);
export type ApprovalKind = z.infer<typeof ApprovalKind>;

export const Approval = z.object({
  id: Id,
  kind: ApprovalKind,
  title: z.string(),
  summary: z.string(),
  amountCents: Cents.nullable(),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["pending", "approved", "declined", "failed", "expired"]),
  requestedBy: z.string(),
  decidedBy: z.string().nullable(),
  decidedAt: IsoDate.nullable(),
  resultMessage: z.string().nullable(),
  version: z.number().int(),
  createdAt: IsoDate,
});
export type Approval = z.infer<typeof Approval>;

// ---------------------------------------------------------------------------
// Stage 10: Learn
// ---------------------------------------------------------------------------
export const LearningInput = z
  .object({
    briefId: Id.optional(),
    statement: z.string().min(10).describe("What we now believe, stated so it can be wrong"),
    evidenceIds: z.array(Id).min(1).describe("Test or decision ids that support it"),
    confidence: z.enum(["low", "medium", "high"]),
    tags: Tags.partial().optional(),
  })
  .strict();
export type LearningInput = z.infer<typeof LearningInput>;

export const Learning = LearningInput.extend({
  id: Id,
  status: z.enum(["active", "flagged", "retired"]),
  reviewedAt: IsoDate.nullable(),
  createdAt: IsoDate,
  createdBy: z.string(),
});
export type Learning = z.infer<typeof Learning>;

export const RatingInput = z
  .object({ variantId: Id, score: z.number().int().min(1).max(5), note: z.string().max(500).optional() })
  .strict();

export const AuditEntry = z.object({
  id: Id,
  actor: z.string(),
  actorKind: z.enum(["human", "agent", "system"]),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()),
  createdAt: IsoDate,
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const Overview = z.object({
  week: z.object({ start: z.string(), capCents: Cents, committedCents: Cents, actualCents: Cents }),
  counts: z.object({
    briefs: z.number().int(),
    variants: z.number().int(),
    testsRunning: z.number().int(),
    pendingApprovals: z.number().int(),
    winners: z.number().int(),
  }),
  costPerVariantTestedCents: z.number().nullable(),
  costPerWinnerCents: z.number().nullable(),
  killSwitchEngaged: z.boolean(),
});
export type Overview = z.infer<typeof Overview>;

export const Digest = z.object({
  since: IsoDate,
  until: IsoDate,
  spendCents: Cents,
  launched: z.array(z.string()),
  killed: z.array(z.string()),
  promoted: z.array(z.string()),
  pendingApprovals: z.array(z.object({ id: Id, title: z.string(), amountCents: Cents.nullable() })),
  alerts: z.array(z.string()),
  text: z.string(),
});
export type Digest = z.infer<typeof Digest>;
