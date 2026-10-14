import { defineConfig } from "@playwright/test";

/** E2E runs against an isolated stack: its own data dir, ports and secrets. */
const API_PORT = 8790;
const WEB_PORT = 5190;
export const E2E = {
  api: `http://localhost:${API_PORT}`,
  web: `http://localhost:${WEB_PORT}`,
  token: "e2e-agent-token-0123456789abcdef",
  password: "e2e-dashboard-password",
};
// A fresh data dir per run (workers inherit this env var, so they agree on it).
process.env.ADLAB_E2E_RUN ??= String(Date.now());
const env = {
  ADLAB_DATA_DIR: `.adlab-e2e/${process.env.ADLAB_E2E_RUN}`,
  ADLAB_API_PORT: String(API_PORT),
  ADLAB_WEB_PORT: String(WEB_PORT),
  ADLAB_API_TOKENS: `e2e-agent:${E2E.token}`,
  ADLAB_API_TOKEN: E2E.token,
  ADLAB_DASHBOARD_PASSWORD: E2E.password,
  ADLAB_SESSION_SECRET: "e2e-session-secret-0123456789abcdefghijkl",
  ADLAB_PLATFORM: "fake",
  ADLAB_RENDERER: "fake",
  DATABASE_URL: "",
};

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: { baseURL: E2E.web, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    {
      command: "npx tsx apps/api/src/main.ts",
      url: `${E2E.api}/v1/health`,
      env,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run -s dev -w @adlab/web",
      url: E2E.web,
      env,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
