import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  type AdPlatform,
  checkLandingPage,
  LocalStorage,
  MetaAdPlatform,
  type Notifier,
  type UrlCheck,
  WebhookNotifier,
} from "@adlab/adapters";
import { type PolicyPack, parsePolicyPack } from "@adlab/core";
import { type Db, type DbHandle, openDb } from "@adlab/db";
import { FakeAdPlatform } from "@adlab/fixtures";
import { pickRenderer, type Renderer } from "@adlab/render";
import { type Config, loadConfig } from "./config";

export interface Ctx {
  db: Db;
  config: Config;
  platform: AdPlatform;
  /** Present only when ADLAB_PLATFORM=fake. */
  fake: FakeAdPlatform | null;
  storage: LocalStorage;
  renderer: Renderer;
  notifier: Notifier;
  policies: PolicyPack[];
  checkUrl: (url: string) => Promise<UrlCheck>;
  /** Wall clock, shifted by simulated hours in fake mode so the whole system agrees on "now". */
  now: () => Date;
}

export function loadPolicyPacks(dir: string): PolicyPack[] {
  const policyDir = path.join(dir, "policies");
  try {
    return readdirSync(policyDir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => {
        const id = f.replace(/\.md$/, "");
        return parsePolicyPack(id, id.split("-")[0] ?? "all", readFileSync(path.join(policyDir, f), "utf8"));
      });
  } catch {
    return [];
  }
}

export interface CreateCtxOptions {
  config?: Config;
  db?: DbHandle;
  platform?: AdPlatform;
  renderer?: Renderer;
  notifier?: Notifier;
  /** Persist the fake platform's state to disk (default true outside tests). */
  persistFake?: boolean;
}

export async function createContext(opts: CreateCtxOptions = {}): Promise<{ ctx: Ctx; handle: DbHandle }> {
  const config = opts.config ?? loadConfig();
  const handle =
    opts.db ?? (await openDb({ url: config.databaseUrl, dataDir: path.join(config.dataDir, "pglite") }));
  await handle.migrate();

  let fake: FakeAdPlatform | null = null;
  let platform = opts.platform;
  if (!platform) {
    if (config.platform === "fake") {
      fake = new FakeAdPlatform({
        seed: 42,
        statePath: opts.persistFake === false ? undefined : path.join(config.dataDir, "fake-platform.json"),
      });
      platform = fake;
    } else {
      if (!config.meta.accessToken || !config.meta.adAccountId)
        throw new Error("ADLAB_PLATFORM=meta needs META_ACCESS_TOKEN and META_AD_ACCOUNT_ID");
      platform = new MetaAdPlatform({
        ...config.meta,
        accessToken: config.meta.accessToken,
        adAccountId: config.meta.adAccountId,
        env: config.rawEnv,
      });
    }
  } else if (platform instanceof FakeAdPlatform) {
    fake = platform;
  }

  const fakeRef = fake;
  const ctx: Ctx = {
    db: handle.db,
    config,
    platform,
    fake,
    storage: new LocalStorage(path.join(config.dataDir, "storage")),
    renderer: opts.renderer ?? pickRenderer(config.rendererMode),
    notifier: opts.notifier ?? new WebhookNotifier(config.webhookUrl),
    policies: loadPolicyPacks(config.knowledgeDir),
    checkUrl: fake
      ? async (url) => {
          const broken = /notrack|broken/.test(url);
          return {
            loads: true,
            status: 200,
            hasPixel: !broken,
            detail: broken ? "Fake check: no tracking tag" : "Fake check: page loads with tracking tag",
          };
        }
      : (url) => checkLandingPage(url),
    now: () => new Date(Date.now() + (fakeRef ? fakeRef.clockHours * 3_600_000 : 0)),
  };
  return { ctx, handle };
}
