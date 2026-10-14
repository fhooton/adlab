import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Boundary rules (fail the fast tier):
 *   - web imports only @adlab/contracts and @adlab/ui (never server code)
 *   - ui imports no @adlab/* package (frontend-only)
 *   - core has no I/O: no node:*, no fetch, no process, no clock or Math.random
 *   - contracts imports only zod
 *   - api, worker, cli and mcp never import each other
 */
const root = fileURLToPath(new URL("../", import.meta.url));

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    if (n === "node_modules" || n === "dist") return [];
    return statSync(full).isDirectory() ? tsFiles(full) : /\.(ts|tsx)$/.test(n) ? [full] : [];
  });
}

const importRe = /(?:import|export)[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const imports = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(importRe)].map((m) => m[1] ?? m[2]!);

interface Rule {
  dir: string;
  allow: (spec: string) => boolean;
  banCode?: RegExp[];
  why: string;
}

const relative = (s: string) => s.startsWith(".");
const rules: Rule[] = [
  {
    dir: "apps/web/src",
    why: "web may only import contracts and ui",
    allow: (s) =>
      relative(s) ||
      s === "@adlab/contracts" ||
      s === "@adlab/ui" ||
      (!s.startsWith("@adlab/") && !s.startsWith("node:")),
  },
  {
    dir: "packages/ui/src",
    why: "ui is frontend-only",
    allow: (s) => relative(s) || (!s.startsWith("@adlab/") && !s.startsWith("node:")),
  },
  {
    dir: "packages/contracts/src",
    why: "contracts depend only on zod",
    allow: (s) => relative(s) || s === "zod",
  },
  {
    dir: "packages/core/src",
    why: "core is pure (no I/O)",
    allow: (s) => relative(s) || s === "@adlab/contracts",
    banCode: [
      /\bfetch\s*\(/,
      /\bprocess\./,
      /Date\.now\(\)/,
      /new Date\(\)/,
      /Math\.random\(/,
      /\brequire\(/,
    ],
  },
  ...["api", "worker"].map((app) => ({
    dir: `apps/${app}/src`,
    why: "apps never import each other",
    allow: (s: string) => !/^@adlab\/(api|worker|cli|mcp|web)$/.test(s) || s === `@adlab/${app}`,
  })),
  ...["cli", "mcp"].map((p) => ({
    dir: `packages/${p}/src`,
    why: "cli/mcp go through the API client",
    allow: (s: string) =>
      !/^@adlab\/(api|worker|cli|mcp|web|services|db|core)$/.test(s) || s === `@adlab/${p}`,
  })),
];

const violations: string[] = [];
for (const rule of rules) {
  let files: string[] = [];
  try {
    files = tsFiles(path.join(root, rule.dir));
  } catch {
    continue;
  }
  for (const f of files) {
    const rel = path.relative(root, f);
    for (const spec of imports(f))
      if (!rule.allow(spec)) violations.push(`${rel}: imports "${spec}" — ${rule.why}`);
    const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const re of rule.banCode ?? [])
      if (re.test(code)) violations.push(`${rel}: uses ${re.source} — ${rule.why}`);
  }
}

if (violations.length) {
  console.error(`Boundary violations:\n  ${violations.join("\n  ")}`);
  process.exit(1);
}
console.log("boundaries ok");
