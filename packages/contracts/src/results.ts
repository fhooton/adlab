import { z } from "zod";
import { Decision, Id, NormalizedMetrics, Test } from "./domain";

export const Interval = z.object({ mean: z.number(), low: z.number(), high: z.number() });
export type Interval = z.infer<typeof Interval>;

export const VariantResult = z.object({
  variantId: Id,
  label: z.string(),
  isControl: z.boolean(),
  metrics: NormalizedMetrics,
  rates: z.object({
    hookRate: z.number().nullable(),
    holdRate: z.number().nullable(),
    ctr: z.number().nullable(),
    cvr: z.number().nullable(),
    cpaCents: z.number().nullable(),
    cpmCents: z.number().nullable(),
  }),
  /** The metric the stage decides on: hook rate for stage 1, conversions per impression for stage 2. */
  primaryMetric: z.enum(["hookRate", "convPerImpression"]),
  interval: Interval.nullable(),
  probBest: z.number().nullable(),
  enoughEvidence: z.boolean(),
  latestDecision: Decision.nullable(),
});
export type VariantResult = z.infer<typeof VariantResult>;

export const TestResults = z.object({
  test: Test,
  variants: z.array(VariantResult),
  lastSyncedAt: z.string().nullable(),
  totalSpendCents: z.number().int(),
});
export type TestResults = z.infer<typeof TestResults>;
