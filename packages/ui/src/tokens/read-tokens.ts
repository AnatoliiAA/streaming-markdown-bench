// Test-support module (not exported from the package entry): reads design tokens
// out of the token CSS files and computes WCAG contrast. Shared by the unit
// token tests and the Playwright token checks.
import { readFileSync } from "node:fs";

export type TokenMap = Record<string, string>;
export interface ThemeTokens {
  light: TokenMap;
  dark: TokenMap;
  darkMedia: TokenMap;
  reducedMotion: TokenMap;
}

interface Block {
  selector: string;
  body: string;
}

const TOKEN_FILES = ["color", "space", "typography", "radius", "motion", "z"] as const;

/** Splits CSS into top-level `selector { body }` blocks (braces balanced, comments stripped). */
function topBlocks(css: string): Block[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: Block[] = [];
  let depth = 0;
  let start = 0;
  let open = -1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        blocks.push({
          selector: src.slice(start, open).trim().replace(/\s+/g, " "),
          body: src.slice(open + 1, i),
        });
        start = i + 1;
      }
    }
  }
  return blocks;
}

function declarations(body: string): TokenMap {
  const out: TokenMap = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = m;
    if (name && value) out[name] = value.trim().replace(/\s+/g, " ");
  }
  return out;
}

function collect(blocks: Block[], selector: string): TokenMap {
  return Object.assign(
    {},
    ...blocks.filter((b) => b.selector === selector).map((b) => declarations(b.body)),
  );
}

export function readTokens(css: string): ThemeTokens {
  const blocks = topBlocks(css);
  const inMedia = (query: string, selector: string): TokenMap =>
    Object.assign(
      {},
      ...blocks
        .filter((b) => b.selector === `@media ${query}`)
        .map((b) => collect(topBlocks(b.body), selector)),
    );
  return {
    light: collect(blocks, ":root"),
    dark: collect(blocks, ':root[data-theme="dark"]'),
    darkMedia: inMedia("(prefers-color-scheme: dark)", ':root:not([data-theme="light"])'),
    reducedMotion: inMedia("(prefers-reduced-motion: reduce)", ":root"),
  };
}

/** Concatenates the token CSS files from disk. */
export function loadTokenCss(): string {
  return TOKEN_FILES.map((f) => readFileSync(new URL(`./${f}.css`, import.meta.url), "utf8")).join(
    "\n",
  );
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #rrggbb color: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => channel(Number.parseInt(h as string, 16))) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two #rrggbb colors. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
