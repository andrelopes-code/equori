import { describe, expect, it } from "vitest";

import { fitFace } from "@/features/overview/cards/fit-face";

describe("fitFace", () => {
  // The root is 14 px. One strip is 18% of the face, 15.5% from four cards; the whole face is
  // its width over 1.586; 14 px stay for the edge of the pocket and the lift.
  it.each([
    // Face: (239 - 14) / (0.18 + 0.63052) = 277.6. Strip: 239 - 14 - 277 / 1.586 = 50.3.
    [550.75, 239, 2, 277, 50],
    // Face: 225 / (2 * 0.18 + 0.63052) = 227.2. Strip: (225 - 143.1) / 2 = 40.9.
    [550.75, 239, 3, 227, 40],
    // Face: 225 / (3 * 0.155 + 0.63052) = 205.4. Strip: (225 - 129.3) / 3 = 31.9.
    [550.75, 239, 4, 205, 31],
    // Face: 225 / (5 * 0.155 + 0.63052) = 160.1. Strip: (225 - 100.9) / 5 = 24.8.
    [550.75, 239, 6, 160, 24],
    // Face: 120.3, under the smallest of 140. Strip: 15.5% of 140 = 21.7; the wallet scrolls.
    [550.75, 239, 9, 140, 21],
    // Face: the height gives 476, the width 550.75 - 21 - 238 = 291, the cap 280. Strip: the
    // 209 px left would pass the whole face of 280 / 1.586 = 176.5.
    [550.75, 400, 2, 280, 176],
    // Face: the cap of 280 again. Strip: three cards share 386 - 176.5 = 209.5, 104.7 each.
    [800, 400, 3, 280, 104],
    // Face: the detail keeps 238 and the gap 21, 480 - 259 = 221. Strip: the whole face, 139.3.
    [480, 400, 2, 221, 139],
  ])(
    "in %f by %f with %i cards the face is %i wide and a strip %i tall",
    (width, height, count, face, strip) => {
      expect(fitFace({ width, height, count, rem: 14 })).toEqual({
        face,
        strip,
      });
    },
  );

  it("leaves the narrow form to its stylesheet", () => {
    expect(
      fitFace({ width: 400, height: 239, count: 2, rem: 14 }),
    ).toBeUndefined();
  });

  it("holds no size without cards or without a measure", () => {
    expect(
      fitFace({ width: 550, height: 239, count: 0, rem: 14 }),
    ).toBeUndefined();
    expect(
      fitFace({ width: 550, height: 0, count: 2, rem: 14 }),
    ).toBeUndefined();
  });
});
