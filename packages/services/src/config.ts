import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Actor, parseAutoApply, parseNamedSecrets } from "@adlab/core";

export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export interface Config {
  env: string;
  apiPort: number;
  webPort: number;
  dataDir: string;
  databaseUrl?: string;
  platform: "fake" | "meta";
  allowLiveWrites: boolean;
  weeklyCapCents: number;
  autoApply: ReturnType<typeof parseAutoApply>;
  rendererMode: string;
  webhookUrl?: string;
  dashboardPassword?: string;
  sessionSecret: string;
  apiTokens: Map<string, string>;
  knowledgeDir: string;
  meta: {
    accessToken?: string;
    adAccountId?: string;
    pageId?: string;
    pixelId?: string;
    testEventCode?: string;
    graphVersion?: string;
  };
  rawEnv: Record<string, string | undefined>;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const dataDir = path.resolve(REPO_ROOT, env.ADLAB_DATA_DIR || ".adlab");
  const platform = (env.ADLAB_PLATFORM || "fake") as Config["platform"];
  if (platform !== "fake" && platform !== "meta")
    throw new Error(`ADLAB_PLATFORM must be fake or meta, got ${platform}`);
  return {
    env: env.ADLAB_ENV || "local",
    apiPort: Number(env.ADLAB_API_PORT || 8787),
    webPort: Number(env.ADLAB_WEB_PORT || 5173),
    dataDir,
    databaseUrl: env.DATABASE_URL || undefined,
    platform,
    allowLiveWrites: env.ADLAB_ENV === "prod" && env.ADLAB_ALLOW_LIVE_WRITES === "true",
    weeklyCapCents: Number(env.ADLAB_WEEKLY_CAP_CENTS || 50_000),
    autoApply: parseAutoApply(env.ADLAB_AUTO_APPLY),
    rendererMode: env.ADLAB_RENDERER || "auto",
    webhookUrl: env.ADLAB_WEBHOOK_URL || undefined,
    dashboardPassword: env.ADLAB_DASHBOARD_PASSWORD || undefined,
    sessionSecret: env.ADLAB_SESSION_SECRET || "",
    apiTokens: parseNamedSecrets(env.ADLAB_API_TOKENS),
    knowledgeDir: path.resolve(REPO_ROOT, "knowledge"),
    meta: {
      accessToken: env.META_ACCESS_TOKEN,
      adAccountId: env.META_AD_ACCOUNT_ID,
      pageId: env.META_PAGE_ID,
      pixelId: env.META_PIXEL_ID,
      testEventCode: env.META_TEST_EVENT_CODE,
      graphVersion: env.META_GRAPH_VERSION,
    },
    rawEnv: env,
  };
}

export const SYSTEM = (name: string): Actor => ({ kind: "system", name });
