import { expect, test } from "bun:test";
import { type RunResult, run, withFile } from "./run";

// Contract: the import-boundary matrix from the Stage 0 plan (Task 4). The tool behind each
// row is an implementation detail; the checker is `biome lint <file> && bun run lint:arch`.
// `biome lint` is only a generic lint sanity step on the row's file; boundary enforcement lives
// in `lint:arch` (dependency-cruiser for packages/ and bench modules, steiger for FSD in apps/site).

const VIOLATIONS: [file: string, source: string, why: string][] = [
  ["packages/ui/src/x.ts", 'import "@smb/bench";', "ui → bench"],
  ["packages/ui/src/x.ts", 'import "@smb/site";', "ui → site"],
  ["packages/bench/src/metrics/x.ts", 'import "@smb/ui";', "bench → ui"],
  ["packages/bench/src/metrics/x.ts", 'import "../runner";', "metrics → runner"],
  ["packages/bench/src/corpus/x.ts", 'import "../metrics";', "corpus → metrics"],
  ["packages/bench/src/adapters/x.ts", 'import "../harness";', "adapters → harness"],
  ["packages/bench/src/harness/x.ts", 'import "../runner";', "harness → runner"],
  ["packages/bench/src/runner/x.ts", 'import "../metrics/flips";', "relative deep import"],
  ["apps/site/src/app/x.ts", 'import "@smb/bench/src/metrics";', "package deep import"],
  ["apps/site/src/entities/a/index.ts", 'import "../../features/b";', "FSD: entities → features"],
  // Regression rows added in review.
  ["packages/bench/src/adapters/x.ts", 'import "../metrics";', "adapters → metrics"],
  ["packages/bench/src/metrics/x.ts", 'import "../corpus";', "metrics → corpus"],
  ["packages/ui/src/x.ts", 'import "../../../apps/site/src/app";', "ui → site via relative path"],
  ["packages/bench/src/runner/deep/y.ts", 'import "../../metrics/flips";', "nested deep import"],
  [
    "packages/bench/src/metrics/x.ts",
    'import type { R } from "../runner";\nexport type X = R;',
    "type-only metrics → runner",
  ],
];

const ALLOWED: [file: string, source: string][] = [
  ["packages/bench/src/runner/x.ts", 'import "../metrics";'],
  ["packages/bench/src/harness/x.ts", 'import "../adapters";'],
  ["apps/site/src/app/x.ts", 'import "@smb/ui";'],
  // The root package and tests/ sit outside the layer rules: tests may use package entry points.
  ["tests/tooling/x.test.ts", 'import "@smb/bench";'],
  ["apps/site/src/features/b/model/index.ts", 'import "../../../entities/a";'],
  ["packages/bench/src/runner/a/b.ts", 'import "../c";'],
  ["packages/bench/src/metrics/x.ts", 'import "node:fs";'],
];

/**
 * Import targets that don't exist yet, created as `export {}` stubs for the row's duration,
 * keyed by the end of the import specifier. steiger only treats a folder as an FSD slice if it
 * has a segment (ui/, model/, ...), so FSD rows also get a `model/` segment in both slices.
 */
const STUBS: Record<string, string[]> = {
  'metrics/flips"': ["packages/bench/src/metrics/flips.ts"],
  '"../../features/b"': [
    "apps/site/src/features/b/index.ts",
    "apps/site/src/features/b/model/index.ts",
    "apps/site/src/entities/a/model/index.ts",
  ],
  '"../../../entities/a"': [
    "apps/site/src/entities/a/index.ts",
    "apps/site/src/entities/a/model/index.ts",
    "apps/site/src/features/b/index.ts",
  ],
  '"../c"': ["packages/bench/src/runner/c.ts"],
};

const output = (r: RunResult) => `${r.stdout}\n${r.stderr}`.replaceAll("\\", "/");

async function check(file: string): Promise<RunResult> {
  const lint = await run(["bunx", "biome", "lint", file]);
  if (lint.code !== 0) return lint;
  const arch = await run(["bun", "run", "lint:arch"]);
  return { code: arch.code, stdout: `${lint.stdout}\n${arch.stdout}`, stderr: arch.stderr };
}

async function withRow(file: string, source: string, fn: () => Promise<void>): Promise<void> {
  const stubs = Object.entries(STUBS).find(([spec]) => source.includes(spec))?.[1] ?? [];
  const body = stubs.reduceRight<() => Promise<void>>(
    (inner, stub) => () => withFile(stub, "export {};\n", inner),
    () => withFile(file, `${source}\n`, fn),
  );
  await body();
}

/** "packages/bench/src/metrics/x.ts" -> "metrics/x.ts": enough to identify the offending file. */
const tail = (file: string) => file.split("/").slice(-2).join("/");

test.each(VIOLATIONS)("%s rejects %s (%s)", async (file, source, why) => {
  await withRow(file, source, async () => {
    const r = await check(file);
    expect(r.code).not.toBe(0);
    expect(output(r)).toContain(tail(file));
    // Must fail on the layer rule, not on some other steiger diagnostic.
    if (why.startsWith("FSD")) expect(output(r)).toContain("fsd/forbidden-imports");
  });
});

test.each(ALLOWED)("%s allows %s", async (file, source) => {
  await withRow(file, source, async () => {
    const r = await check(file);
    expect({ code: r.code, out: output(r) }).toMatchObject({ code: 0 });
  });
});
