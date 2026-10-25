import { expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";
import { expectNoAxeViolations, renderUI, setupUser } from "./index";

test("renders React and queries by role", () => {
  renderUI(<button type="button">Go</button>);
  expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
});

test("axe passes on accessible markup", async () => {
  const { container } = renderUI(<img src="x.png" alt="Chart" />);
  await expectNoAxeViolations(container);
});

test("axe fails on inaccessible markup and names the rule", async () => {
  // biome-ignore lint/a11y/useAltText: deliberately inaccessible to prove axe fails
  const { container } = renderUI(<img src="x.png" />);
  await expect(expectNoAxeViolations(container)).rejects.toThrow(/image-alt/);
});

test("css modules map keys to themselves", async () => {
  const styles = (await import("./fixture.module.css")).default;
  expect(styles.root).toBe("root");
});

test("user-event drives keyboard", async () => {
  const u = setupUser();
  const onClick = mock();
  renderUI(
    <button type="button" onClick={onClick}>
      Go
    </button>,
  );
  await u.tab();
  await u.keyboard("{Enter}");
  expect(onClick).toHaveBeenCalledTimes(1);
});
