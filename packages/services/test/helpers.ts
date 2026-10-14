import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Notifier } from "@adlab/adapters";
import { openDb } from "@adlab/db";
import { FakeAdPlatform } from "@adlab/fixtures";
import { FakeRenderer } from "@adlab/render";
import { createContext, loadConfig } from "../src";

export const human = { kind: "human" as const, name: "Sam" };
export const agent = { kind: "agent" as const, name: "claude-test" };

export async function testContext(
  env: Record<string, string> = {},
  fakeOpts: ConstructorParameters<typeof FakeAdPlatform>[0] = {},
) {
  const dataDir = mkdtempSync(path.join(tmpdir(), "adlab-int-"));
  const config = loadConfig({
    ADLAB_DATA_DIR: dataDir,
    ADLAB_WEEKLY_CAP_CENTS: "100000",
    ADLAB_PLATFORM: "fake",
    ...env,
  });
  const sent: Array<{ type: string; text: string }> = [];
  const notifier: Notifier = { send: async (e) => (sent.push(e), { delivered: true, detail: "test" }) };
  const fake = new FakeAdPlatform({ seed: 7, ...fakeOpts });
  const { ctx, handle } = await createContext({
    config,
    db: await openDb({ dataDir: "memory://" }),
    platform: fake,
    renderer: new FakeRenderer(),
    notifier,
    persistFake: false,
  });
  return { ctx, handle, fake, sent };
}

export const briefInput = {
  product: "Sprout meal kits",
  productUrl: "https://example.com/sprout",
  audience: "Busy parents in the US",
  offer: "50% off your first box",
  markets: ["US"],
  conversionEvent: "purchase",
  weeklyCapCents: 60_000,
};

export const generator = { skill: "adlab-variants", skillVersion: "0.1.0", model: "test-model" };

export function variantSet(hooks: string[]) {
  return hooks.map((hook, i) => ({
    label: i === 0 ? "control" : `hook ${i}`,
    isControl: i === 0,
    templateId: "bold-claim-10s",
    variables: { hook, stat: "30min", statLabel: "from box to table", cta: "Get 50% off", brand: "Sprout" },
    copy: {
      primaryText: "Dinner, sorted. 50% off your first box.",
      headline: "Dinner in 30 minutes",
      cta: "SHOP_NOW" as const,
    },
    hookType: "bold_claim" as const,
    aspectRatios: ["9:16" as const],
  }));
}
