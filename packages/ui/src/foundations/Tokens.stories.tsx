import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import colorCss from "../tokens/color.css?raw";
import spaceCss from "../tokens/space.css?raw";
import typographyCss from "../tokens/typography.css?raw";

/** Custom properties named `<prefix>…` declared in a token file, unique, in declaration order. */
const tokenNames = (css: string, prefix: string): string[] => [
  ...new Set(
    [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] ?? "").filter((n) => n.startsWith(prefix)),
  ),
];

const COLOR_TOKENS = tokenNames(colorCss, "--color-");
const FONT_SIZES = tokenNames(typographyCss, "--font-size-");
const SPACES = tokenNames(spaceCss, "--space-");

const cell: CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  borderBottom: "var(--border-width) solid var(--color-border)",
  textAlign: "start",
};
const heading: CSSProperties = {
  fontSize: "var(--font-size-lg)",
  fontWeight: "var(--font-weight-semibold)",
  margin: "var(--space-6) 0 var(--space-3)",
};

function Tokens() {
  return (
    <div style={{ color: "var(--color-text)", background: "var(--color-bg)" }}>
      <h2 style={heading}>Color</h2>
      <table style={{ borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
        <thead>
          <tr>
            <th scope="col" style={cell}>
              Token
            </th>
            <th scope="col" style={cell}>
              Swatch
            </th>
          </tr>
        </thead>
        <tbody>
          {COLOR_TOKENS.map((name) => (
            <tr key={name}>
              <td style={cell}>
                <code>{name}</code>
              </td>
              <td style={cell}>
                <div
                  aria-hidden="true"
                  style={{
                    width: "var(--space-8)",
                    height: "var(--size-control-sm)",
                    background: `var(${name})`,
                    border: "var(--border-width) solid var(--color-border-strong)",
                    borderRadius: "var(--radius-md)",
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={heading}>Type scale</h2>
      {FONT_SIZES.map((name) => (
        <p key={name} style={{ fontSize: `var(${name})`, margin: "var(--space-2) 0" }}>
          <code style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            {name}
          </code>{" "}
          Streaming markdown renders progressively
        </p>
      ))}

      <h2 style={heading}>Spacing scale</h2>
      {SPACES.map((name) => (
        <div
          key={name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            margin: "var(--space-2) 0",
          }}
        >
          <code style={{ fontSize: "var(--font-size-xs)", minWidth: "var(--space-8)" }}>
            {name}
          </code>
          <div
            aria-hidden="true"
            style={{
              width: `var(${name})`,
              height: "var(--space-5)",
              background: "var(--color-accent)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: "Foundations/Tokens",
  component: Tokens,
} satisfies Meta<typeof Tokens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All = {} satisfies Story;
