import { describe, expect, it } from "vitest";

import { anchoredScroll, fittedSize } from "@/features/transactions/viewer-fit";

describe("fittedSize", () => {
  it.each([
    {
      name: "shrinks a wide picture to the stage's width",
      natural: { width: 2000, height: 1000 },
      stage: { width: 1000, height: 800 },
      zoom: 1,
      want: { width: 1000, height: 500 },
    },
    {
      name: "shrinks a tall picture to the stage's height",
      natural: { width: 1000, height: 3000 },
      stage: { width: 1000, height: 600 },
      zoom: 1,
      want: { width: 200, height: 600 },
    },
    {
      name: "never enlarges a small picture at zoom 1",
      natural: { width: 300, height: 200 },
      stage: { width: 1000, height: 800 },
      zoom: 1,
      want: { width: 300, height: 200 },
    },
    {
      name: "multiplies the fitted size by the zoom",
      natural: { width: 2000, height: 1000 },
      stage: { width: 1000, height: 800 },
      zoom: 2.5,
      want: { width: 2500, height: 1250 },
    },
  ])("$name", ({ natural, stage, zoom, want }) => {
    expect(fittedSize(natural, stage, zoom)).toEqual(want);
  });

  it("knows no size before the picture or the stage is measured", () => {
    expect(fittedSize(null, { width: 10, height: 10 }, 1)).toBeNull();
    expect(fittedSize({ width: 10, height: 10 }, null, 1)).toBeNull();
    expect(
      fittedSize({ width: 0, height: 0 }, { width: 10, height: 10 }, 1),
    ).toBeNull();
  });
});

describe("anchoredScroll", () => {
  it("keeps the point under the anchor in place when the picture doubles", () => {
    const scroll = anchoredScroll({ x: 100, y: 50 }, { x: 200, y: 150 }, 2);

    expect(scroll).toEqual({ x: 400, y: 250 });
  });

  it("keeps the scroll when the zoom does not change", () => {
    const scroll = anchoredScroll({ x: 30, y: 40 }, { x: 200, y: 150 }, 1);

    expect(scroll).toEqual({ x: 30, y: 40 });
  });
});
