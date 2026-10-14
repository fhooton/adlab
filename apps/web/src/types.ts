import type {
  Approval,
  Asset,
  AuditEntry,
  Brief,
  CommandKey,
  Digest,
  Hypothesis,
  Learning,
  NormalizedMetrics,
  Overview,
  PreflightReport,
  ResearchNote,
  Template,
  Test,
  TestResults,
  Variant,
} from "@adlab/contracts";

/** Shapes the API returns that extend the contract types (see packages/services). */
export type AssetView = Asset & { renderer: string };
export type VariantListItem = Variant & { assets: AssetView[]; avgRating: number | null };
export type VariantDetail = VariantListItem & {
  ratings: Array<{ rater: string; score: number; note: string | null }>;
  latestMetrics:
    | (NormalizedMetrics & { capturedAt: string; frequency: number | null; definitionsVersion: string })
    | null;
};
export type BriefDetail = Brief & { research: ResearchNote[]; hypotheses: Hypothesis[]; tests: Test[] };
export type LearningView = Learning & { stale: boolean };
export interface Whoami {
  kind: "human" | "agent" | "system";
  name: string;
}

/** Response body per command, for the commands the dashboard calls. */
export interface Outputs {
  whoami: Whoami;
  overview: Overview;
  briefList: Brief[];
  briefGet: BriefDetail;
  hypothesesList: Hypothesis[];
  templateList: Template[];
  variantsList: VariantListItem[];
  variantGet: VariantDetail;
  testList: Test[];
  testGet: TestResults;
  testPreflight: PreflightReport;
  approvalList: Approval[];
  approvalDecide: Approval;
  learningList: LearningView[];
  ratingAdd: { ok: true };
  killSwitchEngage: { engaged: true; paused: number; failures: string[] };
  killSwitchRelease: { engaged: false; note: string };
  activityList: AuditEntry[];
  digestGet: Digest;
  digestSend: { delivered: boolean; detail?: string; digest: Digest };
}
export type DashboardCommand = keyof Outputs & CommandKey;
