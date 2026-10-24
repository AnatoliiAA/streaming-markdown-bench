// Package and packages/bench module boundaries (spec §5.2). FSD rules for apps/site live in
// steiger.config.mjs. dependency-cruiser was chosen over Biome `noRestrictedImports` because it
// checks resolved files, not import specifier text: a deep import like "../../src/metrics/flips"
// from a nested file is caught here, but no fixed specifier pattern can catch it in Biome.
// The root package and tests/ are outside these rules (only packages/ and apps/ are cruised).

const BENCH = "^packages/bench/src/";

/** packages/bench module `name` may import only itself and the listed modules. */
const benchModule = (name, allowed = []) => ({
  name: `bench-${name}-imports`,
  comment: allowed.length
    ? `bench/${name} may import only: ${allowed.join(", ")}`
    : `bench/${name} imports no other bench module`,
  severity: "error",
  from: { path: `${BENCH}${name}/` },
  to: { path: BENCH, pathNot: `${BENCH}(${[name, ...allowed].join("|")})/` },
});

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "ui-imports-no-package",
      comment: "packages/ui depends on no other workspace package",
      severity: "error",
      from: { path: "^packages/ui/" },
      to: { path: "^(@smb/|packages/(?!ui/)|apps/)" },
    },
    {
      name: "bench-imports-no-package",
      comment: "packages/bench depends on no other workspace package",
      severity: "error",
      from: { path: "^packages/bench/" },
      to: { path: "^(@smb/|packages/(?!bench/)|apps/)" },
    },
    benchModule("corpus"),
    benchModule("metrics"),
    benchModule("adapters"),
    benchModule("harness", ["adapters", "metrics"]),
    benchModule("runner", ["harness", "metrics", "corpus"]),
    {
      name: "bench-no-deep-module-import",
      comment: "other bench modules are reached only through their index.ts",
      severity: "error",
      from: { path: `${BENCH}([^/]+)` },
      to: { path: `${BENCH}[^/]+/`, pathNot: `${BENCH}($1/|[^/]+/index\\.ts$)` },
    },
    {
      name: "no-deep-package-import",
      comment: "another workspace package is reached only through its src/index.ts entry",
      severity: "error",
      from: { path: "^(packages|apps)/([^/]+)/" },
      to: {
        path: "^(packages|apps)/[^/]+/",
        pathNot: "^($1/$2/|(packages|apps)/[^/]+/src/index\\.ts$)",
      },
    },
    {
      name: "no-deep-package-specifier",
      comment: "@smb/<pkg>/<subpath> is a deep import even when it does not resolve",
      severity: "error",
      from: { path: "^(packages|apps)/" },
      to: { path: "^@smb/[^/]+/." },
    },
    {
      name: "not-to-unresolvable",
      comment: "every import in packages/ and apps/ must resolve",
      severity: "error",
      from: { path: "^(packages|apps)/" },
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(node_modules|dist|storybook-static)/" },
    // typescript 7 has no JS API yet, so dependency-cruiser parses TS with swc instead.
    // swc reads the source before type erasure, so `import type` edges are still checked.
    parser: "swc",
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
  },
};
