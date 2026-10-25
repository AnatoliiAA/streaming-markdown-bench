import { describe, expect, test } from "bun:test";
import { contrast, loadTokenCss, readTokens } from "./read-tokens";

const STATUSES = ["match", "diff", "error", "timeout"] as const;
const THEMES = ["light", "dark"] as const;

const TEXT_PAIRS: [string, string][] = [
  ["--color-text", "--color-bg"],
  ["--color-text", "--color-surface"],
  ["--color-text", "--color-bg-subtle"],
  ["--color-text-muted", "--color-bg"],
  ["--color-text-muted", "--color-surface"],
  ["--color-text-muted", "--color-bg-subtle"],
  ["--color-accent", "--color-bg"],
  ["--color-accent", "--color-surface"],
  ["--color-on-accent", "--color-accent"],
  ["--color-on-accent", "--color-accent-hover"],
  ...STATUSES.map((s): [string, string] => [`--color-status-${s}-fg`, `--color-status-${s}-bg`]),
];

// --color-border is deliberately excluded: it is a decorative separator, not a required
// boundary; --color-border-strong carries control identification.
const UI_PAIRS: [string, string][] = [
  ["--color-border-strong", "--color-bg"],
  ["--color-border-strong", "--color-surface"],
  ["--color-border-strong", "--color-bg-subtle"],
  ["--color-accent", "--color-bg"],
  ["--color-focus-ring", "--color-bg"],
  ["--color-focus-ring", "--color-surface"],
];

const COLOR_NAMES = [
  "--color-bg",
  "--color-bg-subtle",
  "--color-surface",
  "--color-border",
  "--color-border-strong",
  "--color-text",
  "--color-text-muted",
  "--color-accent",
  "--color-accent-hover",
  "--color-on-accent",
  "--color-focus-ring",
  ...STATUSES.flatMap((s) => [`--color-status-${s}-fg`, `--color-status-${s}-bg`]),
];

const t = readTokens(loadTokenCss());

function get(theme: (typeof THEMES)[number], name: string): string {
  const v = t[theme][name];
  if (v === undefined) throw new Error(`${theme}: missing ${name}`);
  return v;
}

describe("tokens", () => {
  test.each(THEMES)("%s: text pairs >= 4.5:1", (theme) => {
    for (const [fg, bg] of TEXT_PAIRS) {
      expect(
        contrast(get(theme, fg), get(theme, bg)),
        `${theme} ${fg} on ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test.each(THEMES)("%s: UI pairs >= 3:1", (theme) => {
    for (const [fg, bg] of UI_PAIRS) {
      expect(
        contrast(get(theme, fg), get(theme, bg)),
        `${theme} ${fg} on ${bg}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  test("dark media block equals [data-theme=dark] block", () => {
    expect(Object.keys(t.dark).length).toBeGreaterThan(0);
    expect(t.darkMedia).toEqual(t.dark);
  });

  test.each(THEMES)("%s: every required color token is a #rrggbb hex", (theme) => {
    for (const name of COLOR_NAMES) expect(get(theme, name)).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("every color token in any theme is a #rrggbb hex", () => {
    for (const theme of THEMES) {
      for (const [name, v] of Object.entries(t[theme])) {
        if (name.startsWith("--color-")) expect(v, name).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  test("light and dark define the same color token names", () => {
    const names = (r: Record<string, string>) =>
      Object.keys(r)
        .filter((k) => k.startsWith("--color-"))
        .sort();
    expect(names(t.light)).toEqual([...COLOR_NAMES].sort());
    expect(names(t.dark)).toEqual(names(t.light));
  });

  test("non-color tokens have the specified values", () => {
    expect(t.light).toMatchObject({
      "--space-0": "0",
      "--space-1": "0.125rem",
      "--space-2": "0.25rem",
      "--space-3": "0.5rem",
      "--space-4": "0.75rem",
      "--space-5": "1rem",
      "--space-6": "1.5rem",
      "--space-7": "2rem",
      "--space-8": "3rem",
      "--font-size-xs": "0.75rem",
      "--font-size-sm": "0.875rem",
      "--font-size-md": "1rem",
      "--font-size-lg": "1.125rem",
      "--font-size-xl": "1.375rem",
      "--font-size-2xl": "1.75rem",
      "--line-height-tight": "1.25",
      "--line-height-normal": "1.5",
      "--font-weight-regular": "400",
      "--font-weight-medium": "500",
      "--font-weight-semibold": "600",
      "--radius-sm": "2px",
      "--radius-md": "4px",
      "--radius-lg": "8px",
      "--radius-full": "9999px",
      "--opacity-disabled": "0.5",
      "--border-width": "1px",
      "--focus-ring-width": "2px",
      "--focus-ring-offset": "2px",
      "--duration-fast": "120ms",
      "--duration-normal": "200ms",
      "--ease-standard": "cubic-bezier(0.2, 0, 0, 1)",
      "--z-popover": "100",
      "--z-tooltip": "200",
      "--size-control-sm": "1.75rem",
      "--size-control-md": "2.25rem",
    });
    expect(t.light["--font-sans"]).toContain("Inter Variable");
    expect(t.light["--font-mono"]).toContain("JetBrains Mono Variable");
  });

  test("reduced motion zeroes every --duration-*", () => {
    const durations = Object.keys(t.light).filter((k) => k.startsWith("--duration-"));
    expect(durations.length).toBeGreaterThan(0);
    expect(Object.keys(t.reducedMotion).sort()).toEqual(durations.sort());
    for (const v of Object.values(t.reducedMotion)) expect(v).toBe("0ms");
  });

  test("contrast() matches WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});
