import { type RenderResult, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import axe from "axe-core";
import type { ReactElement } from "react";

export function renderUI(ui: ReactElement): RenderResult {
  return render(ui);
}

export function setupUser(): UserEvent {
  return userEvent.setup();
}

export async function expectNoAxeViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  if (violations.length === 0) return;
  const lines = violations.map(
    (v) => `${v.id}: ${v.help} [${v.nodes.map((n) => n.target.join(" ")).join(", ")}]`,
  );
  throw new Error(`Axe violations:\n${lines.join("\n")}`);
}
