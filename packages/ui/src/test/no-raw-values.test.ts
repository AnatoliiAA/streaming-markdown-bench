import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRawValues } from "./no-raw-values";

describe("findRawValues", () => {
  test("reports hex colors and px lengths", () => {
    const css = ".a { color: #fff; padding: 4px; }";
    const found = findRawValues(css);
    expect(found).toHaveLength(2);
    expect(found.join("\n")).toContain("color: #fff");
    expect(found.join("\n")).toContain("padding: 4px");
  });

  test("allows tokens and keywords", () => {
    const css = `.a {
      padding: var(--space-2) var(--space-3);
      margin: 0;
      width: 100%;
      height: auto;
      color: inherit;
      border-color: currentColor;
      background: transparent;
      border: none;
      color: var(--color-text, inherit);
      min-height: calc(var(--size-control-md) * 2);
      line-height: calc(var(--line-height-normal) * 1);
      transition: opacity var(--duration-fast) var(--ease-standard);
      z-index: var(--z-popover);
    }`;
    expect(findRawValues(css)).toEqual([]);
  });

  test("reports other raw color functions and units", () => {
    for (const decl of [
      "color: rgb(0 0 0)",
      "color: rgba(0, 0, 0, 0.5)",
      "color: hsl(0 0% 0%)",
      "color: oklch(0.5 0.1 200)",
      "padding: 1rem",
      "width: 50%",
      "transition: opacity 120ms",
      "margin: calc(1rem + 2px)",
      "color: red",
      "font-size: 12pt",
      "z-index: 5",
    ]) {
      expect(findRawValues(`.a { ${decl}; }`), decl).toHaveLength(1);
    }
  });

  test("ignores comments and custom property names inside var()", () => {
    expect(findRawValues("/* color: #fff; */ .a { color: var(--color-text); }")).toEqual([]);
  });

  test("reports raw value inside var() fallback", () => {
    expect(findRawValues(".a { color: var(--color-text, #fff); }")).toHaveLength(1);
  });
});

describe("findRawValues: ordinary CSS and bypasses", () => {
  const clean = [
    "display: flex",
    "position: relative",
    "cursor: pointer",
    "border: var(--border-width) solid var(--color-border)",
    "margin: 0 !important",
    "max-width: max(var(--a), 0)",
    "--gap: var(--space-2)",
    "line-height: 1.5",
    "opacity: 1",
    "transition: opacity var(--duration-fast) var(--ease-standard)",
    "width: calc(100% - var(--space-3))",
    "font-family: var(--font-mono)",
  ];
  const raw = [
    "margin: -4px",
    "color: red",
    "--gap: 4px",
    "z-index: 10",
    "--c: #fff",
    "padding: 4px !important",
    "opacity: 0.5",
    "background: white",
  ];
  test.each(clean)("allows %s", (d) => {
    expect(findRawValues(`.a { ${d}; }`)).toEqual([]);
  });
  test.each(raw)("reports %s", (d) => {
    expect(findRawValues(`.a { ${d}; }`)).toHaveLength(1);
  });
});

describe("styles.css and package export", () => {
  const dir = fileURLToPath(new URL("..", import.meta.url));
  test("imports fonts, then tokens, then base, all present", () => {
    const imports = [
      ...readFileSync(join(dir, "styles.css"), "utf8").matchAll(/@import "([^"]+)"/g),
    ].map((m) => m[1]);
    expect(imports).toEqual([
      "@fontsource-variable/inter/index.css",
      "@fontsource-variable/jetbrains-mono/index.css",
      "./tokens/color.css",
      "./tokens/space.css",
      "./tokens/typography.css",
      "./tokens/radius.css",
      "./tokens/motion.css",
      "./tokens/z.css",
      "./base.css",
    ]);
    for (const i of imports) if (i?.startsWith("./")) expect(existsSync(join(dir, i))).toBe(true);
  });
  test("package exports ./styles.css to an existing file", () => {
    const pkg = JSON.parse(readFileSync(join(dir, "..", "package.json"), "utf8"));
    expect(pkg.exports["./styles.css"]).toBe("./src/styles.css");
    expect(existsSync(join(dir, "..", pkg.exports["./styles.css"]))).toBe(true);
  });
});

describe("component CSS modules", () => {
  test("contain no raw colors or sizes", () => {
    const root = fileURLToPath(new URL("../components/", import.meta.url));
    const offenders: string[] = [];
    if (!existsSync(root)) return;
    for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (!rel.endsWith(".module.css")) continue;
      const file = join(root, rel);
      for (const v of findRawValues(readFileSync(file, "utf8"))) offenders.push(`${file}: ${v}`);
    }
    expect(offenders).toEqual([]);
  });
});
