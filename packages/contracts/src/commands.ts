import { z } from "zod";
import {
  BriefInput,
  CreateTestInput,
  CreateVariantsInput,
  Id,
  LearningInput,
  ProposeHypothesesInput,
  RatingInput,
  ResearchNoteInput,
} from "./domain";

/**
 * The single command registry. Every capability is declared once here and surfaced three ways:
 *   - HTTP API  (apps/api implements each `path`)
 *   - CLI       (packages/cli generates `adlab <group> <action>` from `name`)
 *   - MCP       (packages/mcp generates a tool named `name` with `_` instead of `.`)
 *
 * `spend`: "requests_approval" commands never move money directly — they create a pending
 * approval that only a dashboard session can approve. "reduces" commands can only lower spend.
 * `humanOnly`: rejected for agent tokens, whatever client they run in.
 */
export interface CommandDef<S extends z.ZodObject = z.ZodObject> {
  name: string;
  summary: string;
  method: "GET" | "POST";
  path: string;
  input: S;
  spend?: "requests_approval" | "reduces";
  humanOnly?: boolean;
  /** Only available when ADLAB_PLATFORM=fake. */
  simOnly?: boolean;
}

const empty = z.object({}).strict();
const limit = z.coerce.number().int().min(1).max(500).optional();

function cmd<S extends z.ZodObject>(def: CommandDef<S>): CommandDef<S> {
  return def;
}

export const commands = {
  health: cmd({
    name: "health",
    summary: "Check the API is up",
    method: "GET",
    path: "/v1/health",
    input: empty,
  }),
  whoami: cmd({
    name: "whoami",
    summary: "Show which actor this token or session acts as",
    method: "GET",
    path: "/v1/whoami",
    input: empty,
  }),
  overview: cmd({
    name: "overview.get",
    summary: "Weekly spend vs cap, counts, cost per variant and per winner",
    method: "GET",
    path: "/v1/overview",
    input: empty,
  }),

  briefCreate: cmd({
    name: "brief.create",
    summary: "Create a brief (stage 1)",
    method: "POST",
    path: "/v1/briefs",
    input: BriefInput,
  }),
  briefList: cmd({
    name: "brief.list",
    summary: "List briefs",
    method: "GET",
    path: "/v1/briefs",
    input: empty,
  }),
  briefGet: cmd({
    name: "brief.get",
    summary: "Get a brief with its research, hypotheses and tests",
    method: "GET",
    path: "/v1/briefs/:briefId",
    input: z.object({ briefId: Id }),
  }),

  researchAdd: cmd({
    name: "research.add",
    summary: "Record a dated research note with sources and reference ads (stage 2)",
    method: "POST",
    path: "/v1/briefs/:briefId/research",
    input: ResearchNoteInput,
  }),

  hypothesesPropose: cmd({
    name: "hypotheses.propose",
    summary: "Propose an angle matrix (stage 3). Creates an approval for a human to pick which to test.",
    method: "POST",
    path: "/v1/briefs/:briefId/hypotheses",
    input: ProposeHypothesesInput,
  }),
  hypothesesList: cmd({
    name: "hypotheses.list",
    summary: "List hypotheses for a brief",
    method: "GET",
    path: "/v1/briefs/:briefId/hypotheses",
    input: z.object({ briefId: Id }),
  }),

  templateList: cmd({
    name: "template.list",
    summary: "List render templates and their variable schemas",
    method: "GET",
    path: "/v1/templates",
    input: empty,
  }),

  variantsCreate: cmd({
    name: "variants.create",
    summary:
      "Create variant specs for a selected hypothesis (stage 4). Validated against the template schema; each non-control variant must change exactly one variable vs the control.",
    method: "POST",
    path: "/v1/hypotheses/:hypothesisId/variants",
    input: CreateVariantsInput,
  }),
  variantsList: cmd({
    name: "variants.list",
    summary: "List variants",
    method: "GET",
    path: "/v1/variants",
    input: z.object({ briefId: Id.optional(), hypothesisId: Id.optional(), status: z.string().optional() }),
  }),
  variantGet: cmd({
    name: "variant.get",
    summary: "Get a variant with assets, ratings and metrics",
    method: "GET",
    path: "/v1/variants/:variantId",
    input: z.object({ variantId: Id }),
  }),
  variantsRender: cmd({
    name: "variants.render",
    summary: "Queue renders for variants (stage 5). Same spec in, same file out; cached by spec hash.",
    method: "POST",
    path: "/v1/variants/render",
    input: z.object({ variantIds: z.array(Id).min(1) }).strict(),
  }),

  testCreate: cmd({
    name: "test.create",
    summary: "Create a draft test over rendered variants",
    method: "POST",
    path: "/v1/tests",
    input: CreateTestInput,
  }),
  testList: cmd({
    name: "test.list",
    summary: "List tests",
    method: "GET",
    path: "/v1/tests",
    input: z.object({ briefId: Id.optional(), status: z.string().optional() }),
  }),
  testGet: cmd({
    name: "test.get",
    summary: "Get a test with per-variant results, chance-to-beat and latest decisions",
    method: "GET",
    path: "/v1/tests/:testId",
    input: z.object({ testId: Id }),
  }),
  testPreflight: cmd({
    name: "test.preflight",
    summary: "Run pre-flight checks: policy, spec, duplicates, naming, budget, tracking health (stage 6)",
    method: "POST",
    path: "/v1/tests/:testId/preflight",
    input: z.object({ testId: Id }).strict(),
  }),
  testLaunch: cmd({
    name: "test.launch",
    summary:
      "Request launch (stage 7). Creates a pending approval; on approval the API creates PAUSED objects with a lifetime budget, then activates.",
    method: "POST",
    path: "/v1/tests/:testId/launch",
    input: z.object({ testId: Id }).strict(),
    spend: "requests_approval",
  }),
  testSync: cmd({
    name: "test.sync",
    summary: "Pull fresh metrics for a running test (stage 8)",
    method: "POST",
    path: "/v1/tests/:testId/sync",
    input: z.object({ testId: Id }).strict(),
  }),
  testDecide: cmd({
    name: "test.decide",
    summary:
      "Run the rules engine (stage 9). Auto-applies only actions allowed by ADLAB_AUTO_APPLY; the rest become an approval.",
    method: "POST",
    path: "/v1/tests/:testId/decide",
    input: z.object({ testId: Id }).strict(),
  }),

  approvalList: cmd({
    name: "approval.list",
    summary: "List approvals",
    method: "GET",
    path: "/v1/approvals",
    input: z.object({ status: z.enum(["pending", "approved", "declined", "failed", "expired"]).optional() }),
  }),
  approvalDecide: cmd({
    name: "approval.decide",
    summary: "Approve or decline a pending approval. Dashboard sessions only.",
    method: "POST",
    path: "/v1/approvals/:approvalId/decide",
    input: z
      .object({
        approvalId: Id,
        version: z.number().int().describe("Optimistic lock: the version you saw"),
        decision: z.enum(["approve", "decline"]),
        selection: z.array(Id).optional().describe("For select_hypotheses: which hypothesis ids to keep"),
        note: z.string().max(500).optional(),
      })
      .strict(),
    humanOnly: true,
  }),

  learningAdd: cmd({
    name: "learning.add",
    summary: "Record a learning with evidence links and confidence (stage 10)",
    method: "POST",
    path: "/v1/learnings",
    input: LearningInput,
  }),
  learningList: cmd({
    name: "learning.list",
    summary: "List learnings, flagged ones first",
    method: "GET",
    path: "/v1/learnings",
    input: empty,
  }),
  ratingAdd: cmd({
    name: "rating.add",
    summary: "Rate a variant 1-5 (human taste capture)",
    method: "POST",
    path: "/v1/ratings",
    input: RatingInput,
    humanOnly: true,
  }),

  killSwitchEngage: cmd({
    name: "killswitch.engage",
    summary: "Pause everything adlab launched, and block new launches until released",
    method: "POST",
    path: "/v1/kill-switch",
    input: z.object({ reason: z.string().min(3) }).strict(),
    spend: "reduces",
  }),
  killSwitchRelease: cmd({
    name: "killswitch.release",
    summary: "Allow launches again (does not resume paused ads). Dashboard sessions only.",
    method: "POST",
    path: "/v1/kill-switch/release",
    input: empty,
    humanOnly: true,
  }),

  trackingCheck: cmd({
    name: "tracking.check",
    summary: "Send a test conversion event and confirm the landing page loads with its tracking tag",
    method: "POST",
    path: "/v1/tracking/check",
    input: z.object({ url: z.string().url() }).strict(),
  }),
  reconcile: cmd({
    name: "reconcile.run",
    summary: "Compare live platform state with the registry; flag drift without overwriting it",
    method: "POST",
    path: "/v1/reconcile",
    input: empty,
  }),
  activityList: cmd({
    name: "activity.list",
    summary: "Audit log: every write with actor, action and target",
    method: "GET",
    path: "/v1/activity",
    input: z.object({ limit }),
  }),
  digestGet: cmd({
    name: "digest.get",
    summary: "What ran, spent, was killed or promoted, and what awaits approval",
    method: "GET",
    path: "/v1/digest",
    input: z.object({
      hours: z.coerce
        .number()
        .int()
        .min(1)
        .max(24 * 14)
        .optional(),
    }),
  }),
  digestSend: cmd({
    name: "digest.send",
    summary: "Send the digest to ADLAB_WEBHOOK_URL",
    method: "POST",
    path: "/v1/digest/send",
    input: empty,
  }),

  simAdvance: cmd({
    name: "sim.advance",
    summary: "Fake ad platform: advance simulated time so running ads accrue metrics",
    method: "POST",
    path: "/v1/sim/advance",
    input: z
      .object({
        hours: z
          .number()
          .int()
          .min(1)
          .max(24 * 14),
      })
      .strict(),
    simOnly: true,
  }),
} as const;

export type Commands = typeof commands;
export type CommandKey = keyof Commands;
export type CommandInput<K extends CommandKey> = z.input<Commands[K]["input"]>;

export const commandList: CommandDef[] = Object.values(commands);

/** Split an input object into path params (substituted into the path) and the rest. */
export function buildRequest(def: CommandDef, input: Record<string, unknown>) {
  const rest: Record<string, unknown> = { ...input };
  const path = def.path.replace(/:([A-Za-z]+)/g, (_, key: string) => {
    const value = input[key];
    if (value === undefined || value === null || value === "")
      throw new Error(`Missing path parameter: ${key}`);
    if (def.method === "GET") delete rest[key];
    return encodeURIComponent(String(value));
  });
  return {
    method: def.method,
    path,
    body: def.method === "POST" ? input : undefined,
    query: def.method === "GET" ? rest : undefined,
  };
}

/** Exit codes shared by the CLI and documented in AGENTS.md. */
export const ExitCode = {
  ok: 0,
  error: 1,
  invalid: 2,
  auth: 3,
  conflict: 4,
  pendingApproval: 5,
  notFound: 6,
  blocked: 7,
} as const;

export const ErrorBody = z.object({
  error: z.object({
    code: z.enum(["invalid", "auth", "forbidden", "conflict", "not_found", "blocked", "internal"]),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
