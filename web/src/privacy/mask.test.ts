import { describe, expect, it } from "vitest";

import { formatMoneyParts } from "@/i18n/format";
import { MASK, maskParts, maskText } from "@/privacy/mask";

const brl = (amount: number) =>
  formatMoneyParts({ amount, currency: "BRL" }, 2, "pt-BR");

describe("maskText", () => {
  it.each([
    ["a negative amount", -123450],
    ["zero", 0],
    ["a small amount", 5],
  ])("writes the same text for %s", (_name, amount) => {
    expect(maskText(brl(amount))).toBe(`R$ ${MASK}`);
  });

  it("keeps the symbol of an instrument that is not an ISO currency", () => {
    const parts = formatMoneyParts(
      { amount: 1000, currency: "PETR4" },
      2,
      "pt-BR",
    );
    expect(maskText(parts)).toBe(`PETR4 ${MASK}`);
  });
});

describe("maskParts", () => {
  it("drops the sign and the fraction and replaces the integer", () => {
    expect(maskParts(brl(-123450))).toEqual({
      sign: "",
      symbol: "R$",
      integer: MASK,
      fraction: "",
    });
  });
});
