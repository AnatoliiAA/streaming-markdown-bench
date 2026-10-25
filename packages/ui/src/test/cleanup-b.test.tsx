import { expect, test } from "bun:test";
import { renderUI } from "./index";

test("starts with an empty body (first)", () => {
  expect(document.body).toBeEmptyDOMElement();
  renderUI(<button type="button">One</button>);
});

test("starts with an empty body (second)", () => {
  expect(document.body).toBeEmptyDOMElement();
  renderUI(<button type="button">Two</button>);
});
