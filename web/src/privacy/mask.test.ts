import { describe, expect, it } from "vitest";

import { formatMoneyParts, formatMoneySegments } from "@/i18n/format";
import { MASK, maskParts, maskSegments, maskText } from "@/privacy/mask";

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

describe("maskSegments", () => {
  it("keeps the symbol and its place, drops the sign and the fraction, masks the integer", () => {
    const nbsp = "\u00a0";
    expect(
      maskSegments(
        formatMoneySegments({ amount: -123450, currency: "BRL" }, 2, "pt-BR"),
      ),
    ).toEqual([
      { kind: "symbol", text: "R$" },
      { kind: "literal", text: nbsp },
      { kind: "integer", text: MASK },
    ]);
  });

  it("keeps a trailing symbol after the mask", () => {
    const nbsp = "\u00a0";
    expect(
      maskSegments(
        formatMoneySegments({ amount: 123450, currency: "EUR" }, 2, "de-DE"),
      ),
    ).toEqual([
      { kind: "integer", text: MASK },
      { kind: "literal", text: nbsp },
      { kind: "symbol", text: "\u20ac" },
    ]);
  });
});
