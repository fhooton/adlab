import { describe, expect, it } from "vitest";
import { addMetrics, deriveRates, emptyMetrics, normalizeMeta } from "../src";

describe("metric normalization", () => {
  it("normalizes a Meta insights row", () => {
    const m = normalizeMeta(
      {
        impressions: "10000",
        spend: "123.456",
        inline_link_clicks: "150",
        frequency: "1.4",
        actions: [
          { action_type: "video_view", value: "3100" },
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "12" },
          { action_type: "omni_purchase", value: "12" },
        ],
        video_thruplay_watched_actions: [{ action_type: "video_view", value: "900" }],
      },
      "purchase",
    );
    expect(m).toEqual({
      impressions: 10000,
      spendCents: 12346,
      views3s: 3100,
      views15s: 900,
      clicks: 150,
      conversions: 12,
      frequency: 1.4,
    });
  });

  it("treats missing and garbage values as zero", () => {
    const m = normalizeMeta({ impressions: "abc", spend: "NaN" }, "lead");
    expect(m.impressions).toBe(0);
    expect(m.spendCents).toBe(0);
    expect(m.conversions).toBe(0);
    expect(m.frequency).toBeUndefined();
  });

  it("derives rates and handles zero denominators", () => {
    expect(deriveRates(emptyMetrics())).toEqual({
      hookRate: null,
      holdRate: null,
      ctr: null,
      cvr: null,
      cpaCents: null,
      cpmCents: null,
    });
    const r = deriveRates({
      impressions: 1000,
      spendCents: 1000,
      views3s: 300,
      views15s: 60,
      clicks: 10,
      conversions: 2,
    });
    expect(r.hookRate).toBe(0.3);
    expect(r.holdRate).toBe(0.2);
    expect(r.cpaCents).toBe(500);
    expect(r.cpmCents).toBe(1000);
  });

  it("adds metrics", () => {
    const a = { impressions: 1, spendCents: 2, views3s: 3, views15s: 4, clicks: 5, conversions: 6 };
    expect(addMetrics(a, a).conversions).toBe(12);
  });
});
