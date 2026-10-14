import { expect, test } from "@playwright/test";
import { E2E } from "../playwright.config";

/** Critical path: an agent proposes, a human picks in the dashboard, the registry records who. */
const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(`${E2E.api}${path}`, {
    method,
    headers: { authorization: `Bearer ${E2E.token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as any };
};

test("human logs in and approves an agent's angle matrix", async ({ page }) => {
  const brief = (
    await api("POST", "/v1/briefs", {
      product: "Lumen desk lamp",
      productUrl: "https://example.com/lumen",
      audience: "Remote workers",
      offer: "60-night trial",
      markets: ["US"],
      conversionEvent: "purchase",
      weeklyCapCents: 15000,
    })
  ).body;
  const proposed = (
    await api("POST", `/v1/briefs/${brief.id}/hypotheses`, {
      briefId: brief.id,
      hypotheses: [
        {
          concept: "late-night-focus",
          persona: "remote-worker",
          format: "motion_graphic",
          rationale: "Evening productivity angle",
        },
        {
          concept: "eye-strain",
          persona: "remote-worker",
          format: "ugc",
          rationale: "Common review complaint",
        },
      ],
    })
  ).body;

  // Agents can't approve, whatever they try.
  const agentTry = await api("POST", `/v1/approvals/${proposed.approval.id}/decide`, {
    approvalId: proposed.approval.id,
    version: 1,
    decision: "approve",
    selection: [proposed.hypotheses[0].id],
  });
  expect(agentTry.status).toBe(403);

  await page.goto("/login");
  await page.getByLabel("Display name").fill("E2E Human");
  await page.getByLabel("Dashboard password").fill(E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/login/);

  await page.goto("/approvals");
  await page.getByText(proposed.approval.title).first().click();
  await page.getByRole("checkbox", { name: /late-night-focus/ }).check();
  await page.getByRole("button", { name: /Approve 1 selected/ }).click();

  await expect
    .poll(async () =>
      (await api("GET", `/v1/briefs/${brief.id}/hypotheses`)).body
        .map((h: { concept: string; status: string }) => `${h.concept}:${h.status}`)
        .sort(),
    )
    .toEqual(["eye-strain:rejected", "late-night-focus:selected"]);
  const approvals = (await api("GET", "/v1/approvals?status=approved")).body;
  expect(approvals.find((a: { id: string }) => a.id === proposed.approval.id)?.decidedBy).toBe("E2E Human");
  await page.screenshot({ path: "test-results/approvals.png", fullPage: true });
});

test("every main view renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Display name").fill("E2E Human");
  await page.getByLabel("Dashboard password").fill(E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/login/);
  for (const path of [
    "/",
    "/briefs",
    "/variants",
    "/tests",
    "/approvals",
    "/activity",
    "/learnings",
    "/kitchen-sink",
  ]) {
    await page.goto(path);
    await expect(page.locator("main, [role=main]").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
