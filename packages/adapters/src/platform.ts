import type { AdCopy, NormalizedMetrics, Platform } from "@adlab/contracts";

export type ObjectStatus = "ACTIVE" | "PAUSED" | "DELETED";
export type PlatformKind = "campaign" | "adset" | "ad";

export interface CreativeInput {
  assetUrl: string;
  assetPath?: string;
  aspect: string;
  copy: AdCopy;
  destinationUrl: string;
}

export interface CreateObjectInput {
  kind: PlatformKind;
  idempotencyKey: string;
  name: string;
  parentExternalId?: string;
  /** Platform-enforced lifetime budget: caps worst-case spend even if nothing of ours is running. */
  lifetimeBudgetCents?: number;
  endTime?: string;
  conversionEvent?: string;
  creative?: CreativeInput;
}

export interface PlatformObjectState {
  externalId: string;
  kind: PlatformKind;
  name: string;
  status: ObjectStatus;
  parentExternalId?: string;
  lifetimeBudgetCents?: number;
}

export interface InsightRow {
  externalId: string;
  raw: unknown;
  metrics: NormalizedMetrics;
  definitionsVersion: string;
}

export interface TestEventResult {
  received: boolean;
  detail: string;
}

/**
 * Every ad platform sits behind this interface, so every one has a fake for tests.
 * Writes must be idempotent: callers pass an idempotency key and check the registry first;
 * adapters additionally look up by name (which embeds registry IDs) before creating.
 */
export interface AdPlatform {
  readonly platform: Platform;
  readonly mode: "fake" | "live";
  findByName(kind: PlatformKind, name: string): Promise<PlatformObjectState | null>;
  createObject(input: CreateObjectInput): Promise<PlatformObjectState>;
  setStatus(externalId: string, status: Exclude<ObjectStatus, "DELETED">): Promise<void>;
  getObjects(externalIds: string[]): Promise<PlatformObjectState[]>;
  getInsights(adExternalIds: string[], conversionEvent: string): Promise<InsightRow[]>;
  sendTestEvent(eventName: string, url: string): Promise<TestEventResult>;
  health(): Promise<{ ok: boolean; detail: string }>;
}

export class LiveWriteBlockedError extends Error {
  constructor(what: string) {
    super(`Live write blocked (${what}). Set ADLAB_ENV=prod and ADLAB_ALLOW_LIVE_WRITES=true to enable.`);
    this.name = "LiveWriteBlockedError";
  }
}

/** Live adapters are unreachable for writes outside prod. Checked inside every live write. */
export function assertLiveWritesAllowed(env: Record<string, string | undefined>, what: string): void {
  if (env.ADLAB_ENV !== "prod" || env.ADLAB_ALLOW_LIVE_WRITES !== "true")
    throw new LiveWriteBlockedError(what);
}
