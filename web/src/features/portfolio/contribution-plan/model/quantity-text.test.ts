import { describe, expect, it } from "vitest";

import { quantityText } from "@/features/portfolio/contribution-plan/model/quantity-text";

describe("quantityText", () => {
  it.each([
    ["25", "pt-BR", "25"],
    ["1234", "pt-BR", "1.234"],
    ["0.00150000", "pt-BR", "0,0015"],
    ["0.00150000", "en-US", "0.0015"],
    ["12.5", "pt-BR", "12,5"],
  ])("writes %s in %s as %s", (decimal, locale, want) => {
    expect(quantityText(decimal, locale)).toBe(want);
  });
});
