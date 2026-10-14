import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AdlabClient, exitCodeFor } from "@adlab/client";
import { openDb } from "@adlab/db";
import { FakeAdPlatform } from "@adlab/fixtures";
import { FakeRenderer } from "@adlab/render";
import { createContext, loadConfig, syncTemplates } from "@adlab/services";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const TOKEN = "t".repeat(32);
const PASSWORD = "correct horse battery";
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  const config = loadConfig({
    ADLAB_DATA_DIR: mkdtempSync(path.join(tmpdir(), "adlab-api-")),
    ADLAB_API_TOKENS: `ci-agent:${TOKEN}`,
    ADLAB_DASHBOARD_PASSWORD: PASSWORD,
    ADLAB_SESSION_SECRET: "s".repeat(40),
  });
  const { ctx } = await createContext({
    config,
    db: await openDb({ dataDir: "memory://" }),
    platform: new FakeAdPlatform(),
    renderer: new FakeRenderer(),
    persistFake: false,
  });
  await syncTemplates(ctx);
  app = createApp(ctx);
});

const agentFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  app.request(String(input), init)) as typeof fetch;

async function login(name = "Sam") {
  const res = await app.request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD, name }),
  });
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

describe("api", () => {
  it("health is public; everything else needs auth", async () => {
    expect((await app.request("/v1/health")).status).toBe(200);
    expect((await app.request("/v1/briefs")).status).toBe(401);
    expect((await app.request("/v1/briefs", { headers: { authorization: "Bearer nope" } })).status).toBe(401);
  });

  it("agents act under their secret's name", async () => {
    const client = new AdlabClient({ baseUrl: "http://x", token: TOKEN, fetch: agentFetch });
    expect(await client.run("whoami")).toEqual({ kind: "agent", name: "ci-agent" });
  });

  it("rejects wrong passwords and sets an httpOnly session on success", async () => {
    const bad = await app.request("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "nope", name: "Sam" }),
    });
    expect(bad.status).toBe(401);
    const res = await app.request("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD, name: "Sam" }),
    });
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(res.headers.get("set-cookie")).toMatch(/SameSite=Strict/i);
  });

  it("cookie writes need the CSRF header", async () => {
    const cookie = await login();
    const res = await app.request("/v1/kill-switch/release", { method: "POST", headers: { cookie } });
    expect(res.status).toBe(403);
    const ok = await app.request("/v1/kill-switch/release", {
      method: "POST",
      headers: { cookie, "x-adlab-csrf": "1" },
    });
    expect(ok.status).toBe(200);
  });

  it("agent tokens cannot approve, release the kill switch or rate", async () => {
    const auth = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
    const decide = await app.request("/v1/approvals/apr_x/decide", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ approvalId: "apr_x", version: 1, decision: "approve" }),
    });
    expect(decide.status).toBe(403);
    expect((await app.request("/v1/kill-switch/release", { method: "POST", headers: auth })).status).toBe(
      403,
    );
    expect(
      (
        await app.request("/v1/ratings", {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ variantId: "var_x", score: 5 }),
        })
      ).status,
    ).toBe(403);
  });

  it("validation errors are 400 with issues; unknown ids are 404", async () => {
    const auth = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
    const res = await app.request("/v1/briefs", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ product: "x" }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { details: unknown[] } }).error.details.length).toBeGreaterThan(0);
    expect((await app.request("/v1/briefs/brf_missing00", { headers: auth })).status).toBe(404);
  });

  it("serves a live template preview with injected variables", async () => {
    const client = new AdlabClient({ baseUrl: "http://x", token: TOKEN, fetch: agentFetch });
    const brief = await client.run("briefCreate", {
      product: "Thing",
      productUrl: "https://example.com",
      audience: "People",
      offer: "10% off",
      markets: ["US"],
      conversionEvent: "lead",
      weeklyCapCents: 1000,
    });
    const { hypotheses, approval } = await client.run("hypothesesPropose", {
      briefId: brief.id,
      hypotheses: [{ concept: "cc", persona: "pp", format: "motion_graphic", rationale: "because" }],
    });
    const cookie = await login();
    const human = new AdlabClient({
      baseUrl: "http://x",
      headers: { cookie, "x-adlab-csrf": "1" },
      fetch: agentFetch,
    });
    await human.run("approvalDecide", {
      approvalId: approval.id,
      version: approval.version,
      decision: "approve",
      selection: [hypotheses[0].id],
    });
    const [v] = await client.run("variantsCreate", {
      hypothesisId: hypotheses[0].id,
      generator: { skill: "t", skillVersion: "1", model: "m" },
      variants: [
        {
          label: "only",
          isControl: true,
          templateId: "bold-claim-10s",
          variables: { hook: "Hello preview", stat: "1", statLabel: "x", cta: "Go", brand: "B" },
          copy: { primaryText: "p", headline: "h", cta: "LEARN_MORE" },
          hookType: "question",
        },
      ],
    });
    const res = await app.request(`/v1/variants/${v.id}/preview?aspect=1:1`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Hello preview");
    expect(html).toContain('data-width="1080" data-height="1080"');
  });

  it("maps HTTP statuses to CLI exit codes", () => {
    expect([200, 202, 400, 401, 404, 409, 422, 500].map(exitCodeFor)).toEqual([0, 5, 2, 3, 6, 4, 7, 1]);
  });
});
