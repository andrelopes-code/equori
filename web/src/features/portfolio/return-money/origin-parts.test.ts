import { describe, expect, it } from "vitest";

import { originParts } from "@/features/portfolio/return-money/origin-parts";
import type { ReturnMoney } from "@/features/portfolio/return-money/return-money";

const base: ReturnMoney = {
  currency: "BRL",
  opening: 100000,
  deposits: 100000,
  hasFlows: true,
  gain: 5000,
  closing: 205000,
};

describe("originParts", () => {
  it.each([
    {
      name: "three parts above zero",
      money: base,
      want: [
        { key: "opening", amount: 100000 },
        { key: "deposits", amount: 100000 },
        { key: "gain", amount: 5000 },
      ],
    },
    {
      name: "no deposits: the part of zero is left out",
      money: { ...base, deposits: 0, hasFlows: false, closing: 105000 },
      want: [
        { key: "opening", amount: 100000 },
        { key: "gain", amount: 5000 },
      ],
    },
    {
      name: "a loss",
      money: { ...base, gain: -5000, closing: 195000 },
      want: undefined,
    },
    {
      name: "no gain",
      money: { ...base, gain: 0, closing: 200000 },
      want: undefined,
    },
    {
      name: "net withdrawals",
      money: { ...base, deposits: -20000, closing: 85000 },
      want: undefined,
    },
    {
      name: "the gain alone",
      money: { ...base, opening: 0, deposits: 0, closing: 5000 },
      want: undefined,
    },
  ])("RK4: $name", ({ money, want }) => {
    expect(originParts(money)).toEqual(want);
  });
});
