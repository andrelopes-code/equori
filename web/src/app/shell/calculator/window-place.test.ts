import { beforeEach, describe, expect, it } from "vitest";

import { readPlace, writePlace } from "@/app/shell/calculator/window-place";

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
