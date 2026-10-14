import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AspectRatio, Template } from "@adlab/contracts";

/**
 * Render templates. Agents author these occasionally (with the HyperFrames skills); the worker
 * renders them at volume with variables filled in. Bump `version` whenever the HTML changes —
 * the version is part of every variant's spec hash, so old renders are never silently reused.
 */
export const TEMPLATES: Template[] = [
  {
    id: "problem-solution-15s",
    name: "Problem → solution (15s)",
    version: "1.0.0",
    description: "Hook, problem over optional b-roll, solution with brand, offer + CTA. Captions burned in.",
    format: "motion_graphic",
    durationSeconds: 15,
    aspectRatios: ["9:16", "4:5", "1:1"],
    variables: [
      { id: "hook", type: "string", label: "Hook (first 3s)", maxLength: 60 },
      { id: "problem", type: "string", label: "Problem line", maxLength: 80 },
      { id: "solution", type: "string", label: "Solution line", maxLength: 80 },
      { id: "offer", type: "string", label: "Offer", maxLength: 50 },
      { id: "cta", type: "string", label: "CTA button", maxLength: 24 },
      { id: "brand", type: "string", label: "Brand name", maxLength: 30 },
      { id: "accent", type: "color", label: "Accent colour", default: "#ff5a1f" },
      { id: "bg", type: "color", label: "Background", default: "#101114" },
      { id: "fg", type: "color", label: "Text colour", default: "#f5f5f2" },
      { id: "broll", type: "url", label: "B-roll image/video slot", default: "" },
    ],
  },
  {
    id: "bold-claim-10s",
    name: "Bold claim + stat (10s)",
    version: "1.0.0",
    description: "Kinetic word-by-word hook, one big proof stat, CTA. Works without footage.",
    format: "motion_graphic",
    durationSeconds: 10,
    aspectRatios: ["9:16", "4:5", "1:1"],
    variables: [
      { id: "hook", type: "string", label: "Hook", maxLength: 50 },
      { id: "stat", type: "string", label: "Stat", maxLength: 8 },
      { id: "statLabel", type: "string", label: "Stat label", maxLength: 60 },
      { id: "cta", type: "string", label: "CTA button", maxLength: 24 },
      { id: "brand", type: "string", label: "Brand name", maxLength: 30 },
      { id: "accent", type: "color", label: "Accent colour", default: "#2f6bff" },
      { id: "bg", type: "color", label: "Background", default: "#f4f1ea" },
      { id: "fg", type: "color", label: "Text colour", default: "#121212" },
    ],
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export const DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

export function templateSourcePath(id: string): string {
  return fileURLToPath(new URL(`../templates/${id}/index.html`, import.meta.url));
}

/** Variable ids declared in a composed template's HTML (data-composition-variables). */
export function declaredVariables(html: string): string[] {
  const m = /data-composition-variables='([^']+)'/.exec(html);
  if (!m) return [];
  return (JSON.parse(m[1]!.replaceAll("&#39;", "'")) as Array<{ id: string }>).map((v) => v.id);
}

const HF_TYPE: Record<string, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  color: "color",
  url: "image",
};

/** The HyperFrames variable declaration, generated from the manifest (single source of truth). */
export function variablesDeclaration(template: Template): string {
  return JSON.stringify(
    template.variables.map((v) => ({
      id: v.id,
      type: HF_TYPE[v.type] ?? "string",
      label: v.label,
      default: v.default ?? (v.type === "number" ? 0 : v.type === "boolean" ? false : ""),
    })),
  ).replaceAll("'", "&#39;");
}

/**
 * Template HTML for one aspect ratio. With `previewVariables`, the values are injected for the
 * dashboard player (the render path passes them to the HyperFrames CLI instead).
 */
export function composeHtml(
  id: string,
  aspect: AspectRatio,
  previewVariables?: Record<string, unknown>,
): string {
  const template = getTemplate(id);
  if (!template) throw new Error(`Unknown template ${id}`);
  const { width, height } = DIMENSIONS[aspect];
  let html = readFileSync(templateSourcePath(id), "utf8")
    .replace("__VARIABLES__", variablesDeclaration(template))
    .replaceAll("__W__", String(width))
    .replaceAll("__H__", String(height));
  if (previewVariables) {
    const json = JSON.stringify(previewVariables).replace(/</g, "\\u003c");
    html = html.replace("<head>", `<head>\n    <script>window.__hfVariables = ${json};</script>`);
  }
  return html;
}
