import { describe, expect, it } from "vitest";

import { splitParts } from "@/features/calculators/fixed-income-calculator/split-parts";

const names = { net: "Net", tax: "Tax", redemption: "IOF" };
const format = (minor: number) => String(minor);

describe("splitParts", () => {
  it("adds the redemption tax after the tax when there is one", () => {
    const parts = splitParts(
      { net: 3234, tax: 939, redemption: 2056 },
      names,
      format,
    );

    expect(parts.map((p) => p.value)).toEqual([3234, 939, 2056]);
    expect(parts.map((p) => p.label)).toEqual([
      "Net 3234",
      "Tax 939",
      "IOF 2056",
    ]);
  });

  it("keeps two parts without a redemption tax", () => {
    const parts = splitParts(
      { net: 900, tax: 100, redemption: 0 },
      names,
      format,
    );

    expect(parts.map((p) => p.name)).toEqual(["Net", "Tax"]);
  });
});
