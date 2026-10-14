import { mkdtempSync, readFileSync as read, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { composeHtml, declaredVariables, FakeRenderer, TEMPLATES, templateSourcePath } from "../src";

describe("templates", () => {
  for (const t of TEMPLATES) {
    it(`${t.id}: composed HTML declares every manifest variable, and the template reads only those`, () => {
      expect(declaredVariables(composeHtml(t.id, "9:16")).sort()).toEqual(
        t.variables.map((v) => v.id).sort(),
      );
      const source = readFileSync(templateSourcePath(t.id), "utf8");
      const used = [
        ...source.matchAll(/data-var="([a-zA-Z]+)"|vars\.([a-zA-Z]+)|vars\[["']([a-zA-Z]+)/g),
      ].map((m) => m[1] ?? m[2] ?? m[3]);
      const ids = new Set(t.variables.map((v) => v.id));
      expect(used.filter((u) => u && !ids.has(u))).toEqual([]);
    });

    it(`${t.id}: composes every aspect with dimensions and a timeline`, () => {
      for (const aspect of t.aspectRatios) {
        const html = composeHtml(t.id, aspect);
        expect(html).not.toContain("__W__");
        expect(html).toContain('data-composition-id="main"');
        expect(html).toContain('window.__timelines["main"]');
      }
    });
  }

  it("escapes injected preview variables", () => {
    const html = composeHtml("bold-claim-10s", "1:1", { hook: "</script><script>alert(1)</script>" });
    expect(html).not.toContain("</script><script>alert(1)");
  });

  it("fake renderer is deterministic and escapes text", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "adlab-test-"));
    const r = new FakeRenderer();
    const a = await r.render({
      templateId: "bold-claim-10s",
      variables: { hook: "<b>Hi</b>", stat: "1", statLabel: "x", cta: "Go", brand: "B" },
      aspect: "9:16",
      outBase: path.join(dir, "a"),
    });
    const b = await r.render({
      templateId: "bold-claim-10s",
      variables: { hook: "<b>Hi</b>", stat: "1", statLabel: "x", cta: "Go", brand: "B" },
      aspect: "9:16",
      outBase: path.join(dir, "b"),
    });
    expect(read(a.file, "utf8")).toBe(read(b.file, "utf8"));
    expect(read(a.file, "utf8")).not.toContain("<b>");
  });
});
