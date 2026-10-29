import type { MatcherFunction } from "@testing-library/react";

// MoneyValue draws the symbol and the minor digits in unit parts, so an amount is the text of the
// whole value part, never of one text node.
export function moneyValue(text: string | RegExp): MatcherFunction {
  return (_content, element) => {
    if (element?.hasAttribute("data-part-value") !== true) return false;

    const value = element.textContent;
    return typeof text === "string" ? value === text : text.test(value);
  };
}
