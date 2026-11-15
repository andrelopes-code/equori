import type { MatcherFunction } from "@testing-library/react";

// The planning band draws the symbol and the fraction apart, so an amount is the text of the
// whole value element, never of one text node.
export function bandValue(text: string): MatcherFunction {
  return (_content, element) =>
    element?.hasAttribute("data-band-value") === true &&
    element.textContent === text;
}
