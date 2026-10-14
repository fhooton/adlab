import type { Platform } from "@adlab/contracts";
import { METRIC_DEFINITIONS, type MetaInsightsRow, normalizeMeta } from "@adlab/core";
import {
  type AdPlatform,
  assertLiveWritesAllowed,
  type CreateObjectInput,
  type InsightRow,
  type ObjectStatus,
  type PlatformKind,
  type PlatformObjectState,
  type TestEventResult,
} from "./platform";

export interface MetaConfig {
  accessToken: string;
  adAccountId: string;
  pageId?: string;
  pixelId?: string;
  testEventCode?: string;
  graphVersion?: string;
  env: Record<string, string | undefined>;
  fetch?: typeof fetch;
}

const EDGE: Record<PlatformKind, string> = { campaign: "campaigns", adset: "adsets", ad: "ads" };
const OBJECTIVE = "OUTCOME_SALES";

/**
 * Meta Marketing API adapter. Reads work in any environment (Phase 4 shadow mode).
 * Writes are blocked unless ADLAB_ENV=prod and ADLAB_ALLOW_LIVE_WRITES=true (Phase 5+).
 * Status: reads exercised against recorded fixtures; writes are implemented but have not yet
 * been run against a live account — treat as Phase 5 work.
 */
export class MetaAdPlatform implements AdPlatform {
  readonly platform: Platform = "meta";
  readonly mode = "live" as const;
  private readonly base: string;
  private readonly http: typeof fetch;

  constructor(private readonly cfg: MetaConfig) {
    this.base = `https://graph.facebook.com/${cfg.graphVersion ?? "v23.0"}`;
    this.http = cfg.fetch ?? fetch;
  }

  private get account() {
    return this.cfg.adAccountId.startsWith("act_") ? this.cfg.adAccountId : `act_${this.cfg.adAccountId}`;
  }

  private async call<T>(
    method: "GET" | "POST",
    path: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const url = new URL(`${this.base}/${path}`);
    const body = new URLSearchParams();
    const target = method === "GET" ? url.searchParams : body;
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      target.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    url.searchParams.set("access_token", this.cfg.accessToken);
    const res = await this.http(url, method === "POST" ? { method, body } : { method });
    const json = (await res.json()) as T & { error?: { message: string; code: number } };
    if (!res.ok || json.error)
      throw new Error(`Meta API ${method} ${path} failed: ${json.error?.message ?? res.status}`);
    return json;
  }

  async findByName(kind: PlatformKind, name: string): Promise<PlatformObjectState | null> {
    const res = await this.call<{ data: Array<{ id: string; name: string; status: ObjectStatus }> }>(
      "GET",
      `${this.account}/${EDGE[kind]}`,
      {
        fields: "id,name,status",
        filtering: [{ field: "name", operator: "EQUAL", value: name }],
        limit: 2,
      },
    );
    const hit = res.data[0];
    return hit ? { externalId: hit.id, kind, name: hit.name, status: hit.status } : null;
  }

  async createObject(input: CreateObjectInput): Promise<PlatformObjectState> {
    assertLiveWritesAllowed(this.cfg.env, `create ${input.kind}`);
    const existing = await this.findByName(input.kind, input.name);
    if (existing) return existing;
    let params: Record<string, unknown>;
    if (input.kind === "campaign") {
      params = {
        name: input.name,
        objective: OBJECTIVE,
        status: "PAUSED",
        special_ad_categories: [],
        buying_type: "AUCTION",
      };
    } else if (input.kind === "adset") {
      params = {
        name: input.name,
        campaign_id: input.parentExternalId,
        status: "PAUSED",
        lifetime_budget: input.lifetimeBudgetCents,
        end_time: input.endTime,
        billing_event: "IMPRESSIONS",
        optimization_goal: "OFFSITE_CONVERSIONS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        promoted_object: this.cfg.pixelId
          ? {
              pixel_id: this.cfg.pixelId,
              custom_event_type: (input.conversionEvent ?? "purchase").toUpperCase(),
            }
          : undefined,
        targeting: { geo_locations: { countries: ["US"] }, publisher_platforms: ["facebook", "instagram"] },
      };
    } else {
      if (!input.creative) throw new Error("Ad creation needs a creative");
      const video = await this.call<{ id: string }>("POST", `${this.account}/advideos`, {
        file_url: input.creative.assetUrl,
        name: input.name,
      });
      const creative = await this.call<{ id: string }>("POST", `${this.account}/adcreatives`, {
        name: input.name,
        object_story_spec: {
          page_id: this.cfg.pageId,
          video_data: {
            video_id: video.id,
            message: input.creative.copy.primaryText,
            title: input.creative.copy.headline,
            link_description: input.creative.copy.description,
            call_to_action: { type: input.creative.copy.cta, value: { link: input.creative.destinationUrl } },
          },
        },
      });
      params = {
        name: input.name,
        adset_id: input.parentExternalId,
        creative: { creative_id: creative.id },
        status: "PAUSED",
      };
    }
    const created = await this.call<{ id: string }>("POST", `${this.account}/${EDGE[input.kind]}`, params);
    return {
      externalId: created.id,
      kind: input.kind,
      name: input.name,
      status: "PAUSED",
      lifetimeBudgetCents: input.lifetimeBudgetCents,
    };
  }

  async setStatus(externalId: string, status: "ACTIVE" | "PAUSED"): Promise<void> {
    // Pausing reduces spend, so it is allowed whenever writes are configured at all; activation is gated.
    if (status === "ACTIVE") assertLiveWritesAllowed(this.cfg.env, "activate");
    else if (this.cfg.env.ADLAB_ALLOW_LIVE_WRITES !== "true") assertLiveWritesAllowed(this.cfg.env, "pause");
    await this.call("POST", externalId, { status });
  }

  async getObjects(externalIds: string[]): Promise<PlatformObjectState[]> {
    if (externalIds.length === 0) return [];
    const res = await this.call<
      Record<
        string,
        {
          id: string;
          name: string;
          status: ObjectStatus;
          lifetime_budget?: string;
          campaign_id?: string;
          adset_id?: string;
        }
      >
    >("GET", "", { ids: externalIds.join(","), fields: "id,name,status,lifetime_budget" });
    return Object.values(res).map((o) => ({
      externalId: o.id,
      kind: "campaign",
      name: o.name,
      status: o.status,
      lifetimeBudgetCents: o.lifetime_budget ? Number(o.lifetime_budget) : undefined,
    }));
  }

  async getInsights(adExternalIds: string[], conversionEvent: string): Promise<InsightRow[]> {
    const rows: InsightRow[] = [];
    for (const id of adExternalIds) {
      const res = await this.call<{ data: MetaInsightsRow[] }>("GET", `${id}/insights`, {
        fields: "impressions,spend,inline_link_clicks,frequency,actions,video_thruplay_watched_actions",
        date_preset: "maximum",
      });
      const raw = res.data[0] ?? {};
      rows.push({
        externalId: id,
        raw,
        metrics: normalizeMeta(raw, conversionEvent),
        definitionsVersion: METRIC_DEFINITIONS.meta.version,
      });
    }
    return rows;
  }

  async sendTestEvent(eventName: string, url: string): Promise<TestEventResult> {
    if (!this.cfg.pixelId) return { received: false, detail: "META_PIXEL_ID not set" };
    if (!this.cfg.testEventCode)
      return { received: false, detail: "META_TEST_EVENT_CODE not set; cannot send a test event safely" };
    const res = await this.call<{ events_received?: number }>("POST", `${this.cfg.pixelId}/events`, {
      test_event_code: this.cfg.testEventCode,
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: url,
          user_data: { client_user_agent: "adlab-healthcheck" },
        },
      ],
    });
    return {
      received: (res.events_received ?? 0) > 0,
      detail: `events_received=${res.events_received ?? 0}`,
    };
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const res = await this.call<{ data: { is_valid: boolean; expires_at: number } }>("GET", "debug_token", {
        input_token: this.cfg.accessToken,
      });
      const days = res.data.expires_at
        ? Math.round((res.data.expires_at * 1000 - Date.now()) / 86_400_000)
        : null;
      return {
        ok: res.data.is_valid && (days === null || days > 7),
        detail: days === null ? "Token does not expire" : `Token expires in ${days} days`,
      };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }
}
