// Guard helper: finds raw colors/sizes in component CSS modules.
// Flags (a) color syntax: hex, color functions, CSS named colors (transparent and
// currentColor are allowed) and (b) numeric literals: any non-zero number with a unit,
// a percentage other than 0/100%, or a non-zero unitless number, unless it is a
// multiplier inside calc()/min()/max()/clamp() or a normal unitless value
// (line-height, flex, flex-grow/shrink, order, opacity 1). Plain identifiers
// (flex, relative, solid, ...) pass. Custom properties (--x) are checked like any
// other declaration. Scope: declarations only. At-rule preludes (@media queries)
// are out of scope.
const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet " +
    "brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue " +
    "darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange " +
    "darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise " +
    "darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia " +
    "gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo " +
    "ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue " +
    "lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon " +
    "mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue " +
    "mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin " +
    "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen " +
    "paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red " +
    "rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue " +
    "slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
    "whitesmoke yellow yellowgreen canvas canvastext field fieldtext highlight highlighttext linktext " +
    "buttonface buttontext graytext"
  ).split(" "),
);
const UNITLESS_PROPS = new Set(["line-height", "flex", "flex-grow", "flex-shrink", "order"]);
const MATH_FNS = new Set(["calc", "min", "max", "clamp"]);

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

function insideMath(text: string, index: number): boolean {
  const stack: string[] = [];
  for (let i = 0; i < index; i++) {
    const ch = text[i];
    if (ch === "(") {
      stack.push(/([a-z-]*)$/i.exec(text.slice(0, i))?.[1]?.toLowerCase() ?? "");
    } else if (ch === ")") {
      stack.pop();
    }
  }
  return stack.some((n) => MATH_FNS.has(n));
}

function valueIsRaw(value: string, prop: string): boolean {
  let rest = stripVars(value)
    .replace(/!\s*important/gi, " ")
    .replace(/"[^"]*"|'[^']*'|url\([^)]*\)/gi, " ");
  if (/#[0-9a-f]{3,8}\b/i.test(rest)) return true;
  if (/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i.test(rest)) return true;
  rest = rest.replace(/#[0-9a-f]+/gi, " ");
  for (const id of rest.match(/[a-z][a-z-]*/gi) ?? []) {
    if (NAMED_COLORS.has(id.toLowerCase())) return true;
  }
  for (const m of rest.matchAll(/(?<![\w.#-])[+-]?(\d*\.?\d+)([a-z%]*)/gi)) {
    const num = Number(m[1]);
    const unit = (m[2] ?? "").toLowerCase();
    if (num === 0) continue;
    if (unit === "%") {
      if (num === 100 && m[0] === "100%") continue;
      return true;
    }
    if (unit !== "") return true;
    if (insideMath(rest, m.index ?? 0)) continue;
    if (UNITLESS_PROPS.has(prop)) continue;
    if (prop === "opacity" && num === 1) continue;
    return true;
  }
  return false;
}

/** Returns `prop: value` strings for every declaration containing a raw value. */
export function findRawValues(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  for (const m of src.matchAll(/(--[\w-]+|[a-zA-Z-]+)\s*:\s*([^;{}]+?)\s*(?=;|})/g)) {
    const [, prop, value] = m;
    if (!prop || !value) continue;
    if (valueIsRaw(value, prop.toLowerCase())) found.push(`${prop}: ${value}`);
  }
  return found;
}
