import { beforeEach, describe, expect, it } from "vitest";

import {
  clampPlace,
  readPlace,
  writePlace,
} from "@/app/shell/calculator/window-place";

const size = { width: 280, height: 360 };
const area = { width: 1440, height: 800 };

describe("clampPlace (K9)", () => {
  it.each([
    [
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    ],
    [
      { x: -40, y: 20 },
      { x: 0, y: 20 },
    ],
    [
      { x: 1300, y: 20 },
      { x: 1160, y: 20 },
    ],
    [
      { x: 20, y: 700 },
      { x: 20, y: 440 },
    ],
    [
      { x: 20, y: -5 },
      { x: 20, y: 0 },
    ],
  ])("holds %j inside the area as %j", (place, expected) => {
    expect(clampPlace(place, size, area)).toEqual(expected);
  });

  it("keeps the top start corner in an area smaller than the window", () => {
    expect(
      clampPlace({ x: 50, y: 50 }, size, { width: 200, height: 300 }),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("stored place (K5)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads nothing before a place is written", () => {
    expect(readPlace()).toBeNull();
  });

  it("reads the place it wrote", () => {
    writePlace({ x: 12, y: 34 });

    expect(readPlace()).toEqual({ x: 12, y: 34 });
  });

  it.each(["", "{", '{"x":"1","y":2}', '{"x":1}', "null"])(
    "reads nothing from %j",
    (stored) => {
      localStorage.setItem("equori.calculator", stored);

      expect(readPlace()).toBeNull();
    },
  );
});
