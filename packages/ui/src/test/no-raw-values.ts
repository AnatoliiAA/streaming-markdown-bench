// Guard helper: finds raw colors/sizes in component CSS modules. Only tokens
// (`var(--…)`) and a few keywords are allowed as declaration values.
const KEYWORDS = new Set(["0", "100%", "auto", "inherit", "currentcolor", "none", "transparent"]);

function stripVars(value: string): string {
  // Drop var(--x) references but keep any fallback so it gets checked too.
  let out = value;
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/var\(\s*--[\w-]+\s*(?:,\s*([^()]*))?\)/g, (_m, fb: string | undefined) =>
      fb ? ` ${fb} ` : " ",
    );
  }
  return out;
}

const IDENT_PROPS = new Set(["transition", "transition-property", "will-change"]);

function valueIsRaw(value: string, prop: string): boolean {
  const rest = stripVars(value).trim();
  if (rest === "") return false;
  // calc(): only unitless multipliers and operators may remain.
  const noCalc = rest.replace(/calc\(([^()]*)\)/g, (_m, inner: string) =>
    /^[\s\d.+\-*/]*$/.test(inner) ? " " : " RAW ",
  );
  if (/#[0-9a-f]{3,8}\b/i.test(noCalc)) return true;
  if (/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i.test(noCalc)) return true;
  return noCalc
    .split(/[\s,/]+/)
    .filter(Boolean)
    .some((tok) => {
      if (IDENT_PROPS.has(prop) && /^[a-z-]+$/i.test(tok)) return false;
      return !KEYWORDS.has(tok.toLowerCase());
    });
}

/** Returns `prop: value` strings for every declaration containing a raw value. */
export function findRawValues(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  for (const m of src.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+?)\s*(?=;|})/g)) {
    const [, prop, value] = m;
    if (!prop || !value || prop.startsWith("--")) continue;
    if (valueIsRaw(value, prop.toLowerCase())) found.push(`${prop}: ${value}`);
  }
  return found;
}
