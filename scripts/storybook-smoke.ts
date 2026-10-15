import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

/**
 * Render every story in the built Storybook (packages/ui/storybook-static) in headless Chromium
 * and fail on any page error or story error. `--shots <dir>` also saves a screenshot per story.
 */
const root = fileURLToPath(new URL("../packages/ui/storybook-static", import.meta.url));
if (!existsSync(path.join(root, "index.json"))) {
  console.error("No Storybook build found. Run: npm run build-storybook");
  process.exit(1);
}
const shotsArg = process.argv.indexOf("--shots");
const shots = shotsArg > 0 ? process.argv[shotsArg + 1] : undefined;

const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer((req, res) => {
  const rel = decodeURIComponent((req.url ?? "/").split("?")[0]!).replace(/^\/+/, "") || "index.html";
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise<void>((r) => server.listen(0, r));
const base = `http://localhost:${(server.address() as { port: number }).port}`;

const index = JSON.parse(readFileSync(path.join(root, "index.json"), "utf8")) as {
  entries: Record<string, { id: string; type: string }>;
};
const stories = Object.values(index.entries).filter((e) => e.type === "story");
const browser = await chromium.launch();
const failures: string[] = [];

// A fresh page per story: reusing one page across Storybook navigations stalls for ~30s each.
for (const s of stories) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on("pageerror", (e) => failures.push(`${s.id}: ${e.message}`));
  await page.goto(`${base}/iframe.html?id=${s.id}&viewMode=story`, { waitUntil: "domcontentloaded" });
  const outcome = await Promise.race([
    page.waitForSelector("#storybook-root > *", { timeout: 15_000 }).then(() => "ok"),
    page.waitForSelector("body.sb-show-errordisplay", { timeout: 15_000 }).then(() => "error"),
  ]).catch(() => "timeout");
  if (outcome !== "ok") {
    const message = await page
      .locator("#error-message")
      .textContent()
      .catch(() => null);
    failures.push(
      `${s.id}: ${outcome === "error" ? (message ?? "story error") : "did not render within 15s"}`,
    );
  }
  if (shots) await page.screenshot({ path: path.join(shots, `${s.id}.png`), fullPage: true });
  await page.close();
}
await browser.close();
server.close();
if (failures.length) {
  console.error(`✖ ${failures.length} story failure(s):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`✔ ${stories.length} stories rendered without errors`);
