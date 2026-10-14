import type {
  Approval,
  AuditEntry,
  Brief,
  Decision,
  Hypothesis,
  Learning,
  ResearchNote,
  Test,
  Variant,
} from "@adlab/contracts";
import type { schema } from "@adlab/db";

type Row<T extends keyof typeof schema> = (typeof schema)[T]["$inferSelect"];
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export const toBrief = (r: Row<"briefs">): Brief => ({
  id: r.id,
  product: r.product,
  productUrl: r.productUrl,
  audience: r.audience,
  offer: r.offer,
  markets: r.markets,
  languages: r.languages,
  platforms: r.platforms as Brief["platforms"],
  conversionEvent: r.conversionEvent as Brief["conversionEvent"],
  weeklyCapCents: r.weeklyCapCents,
  notes: r.notes ?? undefined,
  status: r.status as Brief["status"],
  createdAt: r.createdAt.toISOString(),
  createdBy: r.createdBy,
});

export const toResearch = (r: Row<"researchNotes">): ResearchNote => ({
  id: r.id,
  briefId: r.briefId,
  summary: r.summary,
  sources: r.sources,
  referenceAds: r.referenceAds as ResearchNote["referenceAds"],
  capturedAt: r.capturedAt.toISOString(),
  createdBy: r.createdBy,
});

export const toHypothesis = (r: Row<"hypotheses">): Hypothesis => ({
  id: r.id,
  briefId: r.briefId,
  concept: r.concept,
  persona: r.persona,
  format: r.format as Hypothesis["format"],
  rationale: r.rationale,
  status: r.status as Hypothesis["status"],
  createdAt: r.createdAt.toISOString(),
  createdBy: r.createdBy,
  decidedBy: r.decidedBy,
});

export const toVariant = (r: Row<"variants">): Variant => ({
  id: r.id,
  hypothesisId: r.hypothesisId,
  briefId: r.briefId,
  label: r.label,
  isControl: r.isControl,
  templateId: r.templateId,
  templateVersion: r.templateVersion,
  variables: r.variables,
  copy: r.copy as Variant["copy"],
  hookType: r.hookType as Variant["hookType"],
  footageSource: r.footageSource as Variant["footageSource"],
  aspectRatios: r.aspectRatios as Variant["aspectRatios"],
  tags: r.tags as Variant["tags"],
  generator: r.generator as Variant["generator"],
  specHash: r.specHash,
  status: r.status as Variant["status"],
  createdAt: r.createdAt.toISOString(),
});

export const toTest = (r: Row<"tests">): Test => ({
  id: r.id,
  briefId: r.briefId,
  stage: r.stage as 1 | 2,
  platform: r.platform as Test["platform"],
  structure: r.structure,
  status: r.status as Test["status"],
  budgetCents: r.budgetCents,
  durationHours: r.durationHours,
  variantIds: r.variantIds,
  ruleVersion: r.ruleVersion,
  startedAt: iso(r.startedAt),
  endedAt: iso(r.endedAt),
  createdAt: r.createdAt.toISOString(),
});

export const toDecision = (r: Row<"decisions">): Decision => ({
  id: r.id,
  testId: r.testId,
  variantId: r.variantId,
  action: r.action as Decision["action"],
  reason: r.reason,
  ruleVersion: r.ruleVersion,
  inputsSnapshot: r.inputsSnapshot,
  status: r.status as Decision["status"],
  proposedBy: r.proposedBy,
  approvedBy: r.approvedBy,
  appliedAt: iso(r.appliedAt),
  version: r.version,
  createdAt: r.createdAt.toISOString(),
});

export const toApproval = (r: Row<"approvals">): Approval => ({
  id: r.id,
  kind: r.kind as Approval["kind"],
  title: r.title,
  summary: r.summary,
  amountCents: r.amountCents,
  payload: r.actionPayload,
  status: r.status as Approval["status"],
  requestedBy: r.requestedBy,
  decidedBy: r.decidedBy,
  decidedAt: iso(r.decidedAt),
  resultMessage: r.resultMessage,
  version: r.version,
  createdAt: r.createdAt.toISOString(),
});

export const toLearning = (r: Row<"learnings">): Learning => ({
  id: r.id,
  briefId: r.briefId ?? undefined,
  statement: r.statement,
  evidenceIds: r.evidenceIds,
  confidence: r.confidence as Learning["confidence"],
  tags: (r.tags ?? undefined) as Learning["tags"],
  status: r.status as Learning["status"],
  reviewedAt: iso(r.reviewedAt),
  createdAt: r.createdAt.toISOString(),
  createdBy: r.createdBy,
});

export const toAudit = (r: Row<"auditLog">): AuditEntry => ({
  id: r.id,
  actor: r.actor,
  actorKind: r.actorKind as AuditEntry["actorKind"],
  action: r.action,
  targetType: r.targetType,
  targetId: r.targetId,
  detail: r.detail,
  createdAt: r.createdAt.toISOString(),
});
