import { expect, test } from "bun:test";
import { screen } from "@testing-library/react";
import { Button } from "react-aria-components";
import { renderUI } from "./index";

test("react-aria-components renders a button with the button role", () => {
  renderUI(<Button>Go</Button>);
  expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
});
