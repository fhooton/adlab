import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  AdPlatform,
  CreateObjectInput,
  InsightRow,
  ObjectStatus,
  PlatformKind,
  PlatformObjectState,
  TestEventResult,
} from "@adlab/adapters";
import type { Platform } from "@adlab/contracts";
import { binomial, createRng, METRIC_DEFINITIONS, normalizeMeta, parseName, seedFrom } from "@adlab/core";

/** True (hidden) rates for a variant. The simulator draws observed metrics from these. */
export interface TrueRates {
  hookRate: number;
  holdRate: number;
  ctr: number;
  cvr: number;
  cpmCents: number;
}

interface SimObject {
  externalId: string;
  kind: PlatformKind;
  name: string;
  status: ObjectStatus;
  parentExternalId?: string;
  lifetimeBudgetCents?: number;
  durationHours: number;
  spentCents: number;
  impressions: number;
  views3s: number;
  views15s: number;
  clicks: number;
  conversions: number;
  idempotencyKey: string;
}

interface SimState {
  seed: number;
  clockHours: number;
  nextId: number;
  objects: Record<string, SimObject>;
  truths: Record<string, TrueRates>;
  rngCalls: number;
}

export interface FakePlatformOptions {
  seed?: number;
  /** Persist state to this JSON file so it survives restarts (local dev). */
  statePath?: string;
  /** Fault injection: probability that a create succeeds on the platform but the response times out. */
  timeoutAfterCreateRate?: number;
}

/** Deterministic default truth for variants nobody registered a truth for. */
export function defaultTruth(variantId: string): TrueRates {
  const rng = createRng(seedFrom(variantId));
  return {
    hookRate: 0.18 + rng() * 0.2,
    holdRate: 0.15 + rng() * 0.2,
    ctr: 0.006 + rng() * 0.014,
    cvr: 0.02 + rng() * 0.06,
    cpmCents: 800 + Math.round(rng() * 600),
  };
}

/**
 * A stateful simulator of the Meta Marketing API surface we use. It returns plausible metrics
 * drawn from known true rates, so end-to-end tests, rules backtests and demos run without spend.
 * It enforces lifetime budgets exactly as the platform would: spend never exceeds them.
 */
export class FakeAdPlatform implements AdPlatform {
  readonly platform: Platform = "meta";
  readonly mode = "fake" as const;
  private state: SimState;
  private rng: () => number;

  constructor(private readonly opts: FakePlatformOptions = {}) {
    const seed = opts.seed ?? 42;
    this.state = { seed, clockHours: 0, nextId: 1000, objects: {}, truths: {}, rngCalls: 0 };
    if (opts.statePath && existsSync(opts.statePath)) {
      this.state = JSON.parse(readFileSync(opts.statePath, "utf8")) as SimState;
    }
    this.rng = this.makeRng();
  }

  private makeRng() {
    const base = createRng(this.state.seed);
    for (let i = 0; i < this.state.rngCalls; i++) base();
    return () => {
      this.state.rngCalls++;
      return base();
    };
  }

  private save() {
    if (!this.opts.statePath) return;
    mkdirSync(path.dirname(this.opts.statePath), { recursive: true });
    writeFileSync(this.opts.statePath, JSON.stringify(this.state));
  }

  get clockHours() {
    return this.state.clockHours;
  }

  setTruth(variantId: string, truth: TrueRates) {
    this.state.truths[variantId] = truth;
    this.save();
  }

  truthFor(variantId: string): TrueRates {
    return this.state.truths[variantId] ?? defaultTruth(variantId);
  }

  private toState(o: SimObject): PlatformObjectState {
    return {
      externalId: o.externalId,
      kind: o.kind,
      name: o.name,
      status: o.status,
      parentExternalId: o.parentExternalId,
      lifetimeBudgetCents: o.lifetimeBudgetCents,
    };
  }

  async findByName(kind: PlatformKind, name: string) {
    const hit = Object.values(this.state.objects).find(
      (o) => o.kind === kind && o.name === name && o.status !== "DELETED",
    );
    return hit ? this.toState(hit) : null;
  }

  async createObject(input: CreateObjectInput): Promise<PlatformObjectState> {
    const existing = Object.values(this.state.objects).find((o) => o.idempotencyKey === input.idempotencyKey);
    if (existing) return this.toState(existing);
    if (
      input.kind !== "campaign" &&
      (!input.parentExternalId || !this.state.objects[input.parentExternalId])
    ) {
      throw new Error(`Parent ${input.parentExternalId} not found`);
    }
    if (input.kind === "ad" && !input.creative) throw new Error("Ad creation needs a creative");
    // Durations are measured on the simulator's own clock (wall clock + simulated hours).
    const nowMs = Date.now() + this.state.clockHours * 3_600_000;
    const durationHours = input.endTime
      ? Math.max(1, Math.round((Date.parse(input.endTime) - nowMs) / 3_600_000))
      : 72;
    const externalId = `${this.state.nextId++}`;
    const obj: SimObject = {
      externalId,
      kind: input.kind,
      name: input.name,
      status: "PAUSED",
      parentExternalId: input.parentExternalId,
      lifetimeBudgetCents: input.lifetimeBudgetCents,
      durationHours,
      spentCents: 0,
      impressions: 0,
      views3s: 0,
      views15s: 0,
      clicks: 0,
      conversions: 0,
      idempotencyKey: input.idempotencyKey,
    };
    this.state.objects[externalId] = obj;
    this.save();
    if (this.opts.timeoutAfterCreateRate && this.rng() < this.opts.timeoutAfterCreateRate) {
      throw new Error("ETIMEDOUT: request timed out (object was created)");
    }
    return this.toState(obj);
  }

  async setStatus(externalId: string, status: "ACTIVE" | "PAUSED") {
    const o = this.state.objects[externalId];
    if (!o) throw new Error(`Object ${externalId} not found`);
    o.status = status;
    this.save();
  }

  async getObjects(externalIds: string[]) {
    return externalIds
      .map((id) => this.state.objects[id])
      .filter((o): o is SimObject => Boolean(o))
      .map((o) => this.toState(o));
  }

  /** Simulate someone editing in Ads Manager, for reconciliation tests. */
  manualEdit(externalId: string, patch: Partial<Pick<SimObject, "status" | "lifetimeBudgetCents">>) {
    const o = this.state.objects[externalId];
    if (!o) throw new Error(`Object ${externalId} not found`);
    Object.assign(o, patch);
    this.save();
  }

  private isDelivering(ad: SimObject): boolean {
    const adset = ad.parentExternalId ? this.state.objects[ad.parentExternalId] : undefined;
    const campaign = adset?.parentExternalId ? this.state.objects[adset.parentExternalId] : undefined;
    return ad.status === "ACTIVE" && adset?.status === "ACTIVE" && campaign?.status === "ACTIVE";
  }

  /** Advance simulated time. Active ads spend their ad set's budget evenly over its duration. */
  advance(hours: number) {
    for (let h = 0; h < hours; h++) {
      for (const ad of Object.values(this.state.objects)) {
        if (ad.kind !== "ad" || !this.isDelivering(ad)) continue;
        const adset = this.state.objects[ad.parentExternalId!]!;
        const budget = adset.lifetimeBudgetCents ?? 0;
        const remaining = budget - adset.spentCents;
        if (remaining <= 0) continue;
        const parsed = parseName(ad.name);
        const truth = this.truthFor(parsed?.variantId ?? ad.externalId);
        // ±25% hourly pacing noise, capped by the lifetime budget.
        const spend = Math.min(
          remaining,
          Math.max(1, Math.round((budget / adset.durationHours) * (0.75 + this.rng() * 0.5))),
        );
        const impressions = Math.max(0, Math.round((spend / truth.cpmCents) * 1000));
        const views3s = binomial(this.rng, impressions, truth.hookRate);
        const views15s = binomial(this.rng, views3s, truth.holdRate);
        const clicks = binomial(this.rng, impressions, truth.ctr);
        const conversions = binomial(this.rng, clicks, truth.cvr);
        adset.spentCents += spend;
        ad.spentCents += spend;
        ad.impressions += impressions;
        ad.views3s += views3s;
        ad.views15s += views15s;
        ad.clicks += clicks;
        ad.conversions += conversions;
      }
      this.state.clockHours++;
    }
    this.save();
  }

  /** Raw rows shaped like the Meta insights API, so normalization is exercised too. */
  rawInsights(ad: SimObject, conversionEvent: string) {
    return {
      impressions: String(ad.impressions),
      spend: (ad.spentCents / 100).toFixed(2),
      inline_link_clicks: String(ad.clicks),
      frequency: ad.impressions > 0 ? "1.1" : "0",
      actions: [
        { action_type: "video_view", value: String(ad.views3s) },
        {
          action_type:
            conversionEvent === "purchase" ? "offsite_conversion.fb_pixel_purchase" : conversionEvent,
          value: String(ad.conversions),
        },
      ],
      video_thruplay_watched_actions: [{ action_type: "video_view", value: String(ad.views15s) }],
    };
  }

  async getInsights(adExternalIds: string[], conversionEvent: string): Promise<InsightRow[]> {
    return adExternalIds
      .map((id) => this.state.objects[id])
      .filter((o): o is SimObject => Boolean(o))
      .map((ad) => {
        const raw = this.rawInsights(ad, conversionEvent);
        return {
          externalId: ad.externalId,
          raw,
          metrics: normalizeMeta(raw, conversionEvent),
          definitionsVersion: METRIC_DEFINITIONS.meta.version,
        };
      });
  }

  async sendTestEvent(_eventName: string, url: string): Promise<TestEventResult> {
    const broken = /broken|notrack/.test(url);
    return {
      received: !broken,
      detail: broken ? "Fake platform: no event received" : "Fake platform: test event received",
    };
  }

  async health() {
    return { ok: true, detail: "Fake ad platform" };
  }

  /** Total spend across all ad sets (for invariant checks). */
  totalSpend() {
    return Object.values(this.state.objects)
      .filter((o) => o.kind === "adset")
      .reduce((s, o) => s + o.spentCents, 0);
  }

  objects() {
    return Object.values(this.state.objects).map((o) => ({ ...o }));
  }
}
