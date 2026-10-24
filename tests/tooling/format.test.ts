import { expect, test } from "bun:test";
import { run, withFile } from "./run";

test("badly formatted source fails biome ci", async () => {
  await withFile("packages/bench/src/bad.ts", "export const  a=1", async () => {
    expect((await run(["bunx", "biome", "ci", "packages/bench/src/bad.ts"])).code).not.toBe(0);
  });
});

test("well formatted source passes", async () => {
  await withFile("packages/bench/src/good.ts", 'export const a = "x";\n', async () => {
    expect((await run(["bunx", "biome", "ci", "packages/bench/src/good.ts"])).code).toBe(0);
  });
});

test("generated folders are ignored", async () => {
  await withFile("packages/ui/dist/x.js", "const  a=1", async () => {
    expect((await run(["bunx", "biome", "ci", "."])).code).toBe(0);
  });
});

test("CRLF is rejected", async () => {
  await withFile("packages/bench/src/crlf.ts", 'export const a = "x";\r\n', async () => {
    expect((await run(["bunx", "biome", "ci", "packages/bench/src/crlf.ts"])).code).not.toBe(0);
  });
});
