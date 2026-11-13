import { describe, expect, it } from "vitest";

import {
  panelArt,
  plateArt,
  plateShape,
} from "@/features/accounts/kind-chooser/kind-art";
import { kinds } from "@/features/accounts/model/account-kinds";

// Shape counts of the `<g id="k-…">` and `<g id="m-…">` of the approved mock.
const panelCounts = {
  checking: 7,
  cash: 8,
  wallet: 8,
  benefit: 7,
  savings: 9,
  reserve: 7,
  brokerage: 12,
  receivable: 5,
  credit_card: 6,
  loan: 13,
  payable: 6,
};

const plateCounts = {
  checking: 6,
  cash: 5,
  wallet: 5,
  benefit: 3,
  savings: 5,
  reserve: 6,
  brokerage: 7,
  receivable: 5,
  credit_card: 4,
  loan: 3,
  payable: 5,
};

describe("panelArt and plateArt", () => {
  it.each(kinds)("%s holds the shapes of the mock", (kind) => {
    expect(panelArt[kind]).toHaveLength(panelCounts[kind]);
    expect(plateArt[kind]).toHaveLength(plateCounts[kind]);
  });

  it("keeps the paint classes of a shape as separate entries", () => {
    expect(panelArt.checking[0]).toEqual({
      el: "path",
      paint: ["g1", "gj"],
      d: "M24 5.6 42.2 16.2v2.6H5.8v-2.6z",
    });
    expect(plateArt.checking[1]).toEqual({
      el: "circle",
      paint: ["g0"],
      cx: 24,
      cy: 15.4,
      r: 1.5,
    });
    expect(panelArt.checking[2]).toEqual({
      el: "rect",
      paint: ["g1"],
      x: 8,
      y: 22,
      width: 5.5,
      height: 13,
      rx: 1.4,
    });
  });
});

describe("plateShape", () => {
  it.each([
    ["checking", "square"],
    ["cash", "square"],
    ["wallet", "square"],
    ["benefit", "square"],
    ["savings", "circle"],
    ["reserve", "circle"],
    ["brokerage", "circle"],
    ["receivable", "square"],
    ["credit_card", "square"],
    ["loan", "square"],
    ["payable", "square"],
  ] as const)("%s is a %s", (kind, want) => {
    expect(plateShape(kind)).toBe(want);
  });
});
