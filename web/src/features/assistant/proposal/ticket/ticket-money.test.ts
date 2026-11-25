import { describe, expect, it } from "vitest";

import {
  absolute,
  leaves,
  priced,
  sumOf,
} from "@/features/assistant/proposal/ticket/ticket-money";

const brl = (amount: string) => ({ amount, currency: "BRL" });

describe("ticket money", () => {
  it("reads the direction of a net from its sign", () => {
    expect(leaves(brl("-210.99"))).toBe(true);
    expect(leaves(brl("0.00"))).toBe(false);
    expect(absolute(brl("-210.99"))).toEqual(brl("210.99"));
    expect(absolute(brl("3818.66"))).toEqual(brl("3818.66"));
  });

  it.each([
    ["38.2", "3820.00", "38.20"],
    ["105.47", "210.94", "105.47"],
    ["10", "100.00", "10.00"],
    ["1.234567891234", "12.35", "1.234567891234"],
    ["500", "500", "500"],
  ])("writes the price %s beside %s as %s", (price, amount, want) => {
    expect(priced({ text: price }, brl(amount))).toEqual(brl(want));
  });

  it("adds amounts of one currency in minor units", () => {
    expect(sumOf([brl("1102.00"), brl("98.70")])).toEqual(brl("1200.70"));
    expect(sumOf([brl("0.10"), brl("0.20")])).toEqual(brl("0.30"));
    expect(sumOf([])).toBeUndefined();
  });
});
