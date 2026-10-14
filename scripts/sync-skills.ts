import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Skills are canonical in .agents/skills (Codex and OpenCode read it natively). Claude Code
 * reads .claude/skills, so we copy. `--check` fails on drift (run in `npm run verify`).
 */
const root = fileURLToPath(new URL("../", import.meta.url));
const src = path.join(root, ".agents/skills");
const dst = path.join(root, ".claude/skills");

function files(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full, base) : [path.relative(base, full)];
  });
}

export function syncSkills({ check }: { check: boolean }) {
  const a = files(src).sort();
  const b = files(dst).sort();
  const drift = [...new Set([...a, ...b])].filter(
    (f) =>
      !a.includes(f) ||
      !b.includes(f) ||
      readFileSync(path.join(src, f), "utf8") !== readFileSync(path.join(dst, f), "utf8"),
  );
  if (check) return { ok: drift.length === 0, drift, copied: 0 };
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  return { ok: true, drift: [], copied: readdirSync(src).length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const check = process.argv.includes("--check");
  const res = syncSkills({ check });
  if (check && !res.ok) {
    console.error(
      `Skills drift between .agents/skills and .claude/skills:\n  ${res.drift.join("\n  ")}\nRun: npm run skills:sync`,
    );
    process.exit(1);
  }
  console.log(check ? "skills in sync" : `synced ${res.copied} skills to .claude/skills`);
}
