import { describe, expect, it } from "vitest";

import { rgbToHex } from "@/features/setup/rgb-to-hex";

describe("rgbToHex", () => {
  it.each([
    ["rgb(21, 128, 61)", "#15803d"],
    ["rgb(0 0 0)", "#000000"],
    [" #15803D ", "#15803d"],
  ])("writes %s as %s", (value, hex) => {
    expect(rgbToHex(value)).toBe(hex);
  });

  it.each(["", "gray", "rgb(300, 0, 0)", "rgba(0, 0, 0, 0.5)"])(
    "refuses %s",
    (value) => {
      expect(rgbToHex(value)).toBeNull();
    },
  );
});
