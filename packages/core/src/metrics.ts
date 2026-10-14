import type { NormalizedMetrics } from "@adlab/contracts";

/**
 * Metric definitions live in code, per platform, and are versioned. Raw payloads are stored next
 * to snapshots so these can be recomputed when definitions change.
 */
export const METRIC_DEFINITIONS = {
  meta: {
    version: "meta-2026-10",
    hookView: "3-second video views (actions[video_view])",
    holdView: "ThruPlays: 15s or complete (video_thruplay_watched_actions)",
    click: "inline_link_clicks",
    attribution: "7d click / 1d view (account default)",
  },
  tiktok: {
    version: "tiktok-2026-10",
    hookView: "2-second video views (video_watched_2s)",
    holdView: "6-second focused views (video_watched_6s)",
    click: "clicks",
    attribution: "7d click / 1d view",
  },
} as const;

type ActionList = Array<{ action_type: string; value: string | number }> | undefined;

export interface MetaInsightsRow {
  impressions?: string | number;
  spend?: string | number;
  inline_link_clicks?: string | number;
  frequency?: string | number;
  actions?: ActionList;
  video_thruplay_watched_actions?: ActionList;
}

const META_CONVERSION_ACTIONS: Record<string, string[]> = {
  purchase: ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"],
  lead: ["offsite_conversion.fb_pixel_lead", "lead", "onsite_conversion.lead_grouped"],
  install: ["mobile_app_install", "app_install"],
  signup: ["offsite_conversion.fb_pixel_complete_registration", "complete_registration"],
  add_to_cart: ["offsite_conversion.fb_pixel_add_to_cart", "add_to_cart"],
};

const int = (v: string | number | undefined) => {
  const n = typeof v === "number" ? v : Number.parseFloat(v ?? "0");
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

const sumActions = (list: ActionList, types: string[]) => {
  if (!list) return 0;
  // Meta reports overlapping aliases (e.g. purchase and omni_purchase); take the max, not the sum.
  return Math.max(0, ...list.filter((a) => types.includes(a.action_type)).map((a) => int(a.value)));
};

export function normalizeMeta(row: MetaInsightsRow, conversionEvent: string): NormalizedMetrics {
  const spendUnits = typeof row.spend === "number" ? row.spend : Number.parseFloat(row.spend ?? "0");
  return {
    impressions: int(row.impressions),
    spendCents: Number.isFinite(spendUnits) ? Math.max(0, Math.round(spendUnits * 100)) : 0,
    views3s: sumActions(row.actions, ["video_view"]),
    views15s: sumActions(row.video_thruplay_watched_actions, ["video_view"]),
    clicks: int(row.inline_link_clicks),
    conversions: sumActions(row.actions, META_CONVERSION_ACTIONS[conversionEvent] ?? [conversionEvent]),
    frequency: row.frequency === undefined ? undefined : Number(row.frequency),
  };
}

export const emptyMetrics = (): NormalizedMetrics => ({
  impressions: 0,
  spendCents: 0,
  views3s: 0,
  views15s: 0,
  clicks: 0,
  conversions: 0,
});

export function addMetrics(a: NormalizedMetrics, b: NormalizedMetrics): NormalizedMetrics {
  return {
    impressions: a.impressions + b.impressions,
    spendCents: a.spendCents + b.spendCents,
    views3s: a.views3s + b.views3s,
    views15s: a.views15s + b.views15s,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
  };
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : null);

export function deriveRates(m: NormalizedMetrics) {
  return {
    hookRate: ratio(m.views3s, m.impressions),
    holdRate: ratio(m.views15s, m.views3s),
    ctr: ratio(m.clicks, m.impressions),
    cvr: ratio(m.conversions, m.clicks),
    cpaCents: m.conversions > 0 ? m.spendCents / m.conversions : null,
    cpmCents: m.impressions > 0 ? (m.spendCents / m.impressions) * 1000 : null,
  };
}
