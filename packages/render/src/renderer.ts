import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AspectRatio, VariableValues } from "@adlab/contracts";
import { composeHtml, DIMENSIONS, getTemplate } from "./templates";

export interface RenderRequest {
  templateId: string;
  variables: VariableValues;
  aspect: AspectRatio;
  /** Output file path without extension; the renderer picks the extension. */
  outBase: string;
}

export interface RenderResult {
  file: string;
  kind: "video" | "image";
  renderer: string;
  durationSeconds: number | null;
  ms: number;
  costCents: number;
}

export interface Renderer {
  readonly name: string;
  render(req: RenderRequest): Promise<RenderResult>;
}

export const HYPERFRAMES_VERSION = "0.8.157";

/** Renders with the HyperFrames CLI (headless Chromium + FFmpeg). Same spec in, same video out. */
export class HyperFramesRenderer implements Renderer {
  readonly name = `hyperframes@${HYPERFRAMES_VERSION}`;

  async render(req: RenderRequest): Promise<RenderResult> {
    const template = getTemplate(req.templateId);
    if (!template) throw new Error(`Unknown template ${req.templateId}`);
    const started = Date.now();
    const dir = await mkdtemp(path.join(tmpdir(), "adlab-render-"));
    try {
      await writeFile(path.join(dir, "index.html"), composeHtml(req.templateId, req.aspect));
      await writeFile(path.join(dir, "variables.json"), JSON.stringify(req.variables));
      const file = `${req.outBase}.mp4`;
      await run(
        "npx",
        [
          "-y",
          `hyperframes@${HYPERFRAMES_VERSION}`,
          "render",
          dir,
          "--variables-file",
          path.join(dir, "variables.json"),
          "--strict-variables",
          "--quiet",
          "-o",
          file,
        ],
        {
          HYPERFRAMES_SKIP_SKILLS: "1",
        },
      );
      // Compute cost is local; record 0 until the hosted worker reports real cost per minute.
      return {
        file,
        kind: "video",
        renderer: this.name,
        durationSeconds: template.durationSeconds,
        ms: Date.now() - started,
        costCents: 0,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function run(cmd: string, args: string[], env: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`)),
    );
  });
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Deterministic placeholder renderer for tests, CI and machines without FFmpeg. Writes an SVG
 * poster of the variant so the dashboard still has something real to review.
 */
export class FakeRenderer implements Renderer {
  readonly name = "fake-svg";

  async render(req: RenderRequest): Promise<RenderResult> {
    const template = getTemplate(req.templateId);
    if (!template) throw new Error(`Unknown template ${req.templateId}`);
    const { width, height } = DIMENSIONS[req.aspect];
    const v = req.variables;
    const defaults = Object.fromEntries(template.variables.map((x) => [x.id, x.default]));
    const get = (k: string) => v[k] ?? defaults[k] ?? "";
    const lines = ["hook", "problem", "solution", "stat", "statLabel", "offer"]
      .map(get)
      .filter(Boolean)
      .slice(0, 4);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${esc(get("bg") || "#101114")}"/>
  <rect x="86" y="${height * 0.16}" width="190" height="16" rx="8" fill="${esc(get("accent") || "#ff5a1f")}"/>
  ${lines.map((t, i) => `<text x="86" y="${height * 0.16 + 120 + i * 120}" font-family="Inter, system-ui, sans-serif" font-size="${i === 0 ? 76 : 52}" font-weight="${i === 0 ? 800 : 600}" fill="${esc(get("fg") || "#f5f5f2")}">${esc(t)}</text>`).join("\n  ")}
  <rect x="86" y="${height * 0.72}" rx="26" width="420" height="110" fill="${esc(get("accent") || "#ff5a1f")}"/>
  <text x="120" y="${height * 0.72 + 72}" font-family="Inter, system-ui, sans-serif" font-size="46" font-weight="800" fill="#fff">${esc(get("cta"))}</text>
  <text x="86" y="${height - 60}" font-family="ui-monospace, monospace" font-size="28" fill="#888">${esc(template.id)} · ${req.aspect} · preview render</text>
</svg>`;
    const file = `${req.outBase}.svg`;
    await writeFile(file, svg);
    return { file, kind: "image", renderer: this.name, durationSeconds: null, ms: 0, costCents: 0 };
  }
}

export function hasFfmpeg(): boolean {
  try {
    return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

export function pickRenderer(mode: string | undefined): Renderer {
  if (mode === "fake") return new FakeRenderer();
  if (mode === "hyperframes") return new HyperFramesRenderer();
  return hasFfmpeg() ? new HyperFramesRenderer() : new FakeRenderer();
}
