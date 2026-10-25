import { expect, test } from "bun:test";
import { run, withFile } from "./run";

const ci = (target: string) => run(["bunx", "biome", "ci", target]);
const output = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;

test("badly formatted source fails biome ci", async () => {
  await withFile("packages/bench/src/bad.ts", "export const  a=1", async () => {
    const r = await ci("packages/bench/src/bad.ts");
    expect(r.code).not.toBe(0);
    expect(output(r)).toContain("bad.ts");
    expect(output(r)).toMatch(/format/i);
  });
});

test("well formatted source passes", async () => {
  await withFile("packages/bench/src/good.ts", 'export const a = "x";\n', async () => {
    expect((await ci("packages/bench/src/good.ts")).code).toBe(0);
  });
});

test("CRLF is rejected", async () => {
  await withFile("packages/bench/src/crlf.ts", 'export const a = "x";\r\n', async () => {
    const r = await ci("packages/bench/src/crlf.ts");
    expect(r.code).not.toBe(0);
    expect(output(r)).toContain("crlf.ts");
    expect(output(r)).toMatch(/format/i);
  });
});

const ignored = [
  "packages/ui/dist/x.js",
  "packages/ui/storybook-static/x.js",
  "packages/ui/playwright-report/x.js",
  "packages/ui/test-results/x.js",
  "results/x.js",
  "corpus/cases/x.js",
  "docs/x.md",
];

test.each(ignored)("ignored location %s does not affect biome ci .", async (path) => {
  await withFile(path, path.endsWith(".md") ? "#  bad\n\n\n\ntext" : "const  a=1", async () => {
    const r = await ci(".");
    expect(r.code).toBe(0);
    expect(output(r)).not.toContain("x.js");
    expect(output(r)).not.toContain("x.md");
  });
});
