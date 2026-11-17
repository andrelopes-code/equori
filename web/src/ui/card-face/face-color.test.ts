import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { faceColor, graphite, slotHex } from "@/ui/card-face/face-color";

const css = readFileSync("src/app/app.css", "utf8");

describe("slotHex", () => {
  it.each([
    [1, "#7368d4"],
    [8, "#c4530f"],
    [undefined, undefined],
    [9, undefined],
  ])("slot %s is %s", (slot, expected) => {
    expect(slotHex(slot)).toBe(expected);
  });

  it("equals the light-scheme value of --equori-slot-N in app.css", () => {
    for (let n = 1; n <= 8; n++) {
      const match = new RegExp(
        `--equori-slot-${String(n)}:\\s*(#[0-9a-f]{6})`,
      ).exec(css);

      expect(slotHex(n)).toBe(match?.[1]);
    }
  });
});

describe("faceColor", () => {
  it.each([
    ["#112233", 1, "#112233"],
    [undefined, 1, "#7368d4"],
    [undefined, undefined, graphite],
  ])("colour %s with slot %s is %s", (color, slot, expected) => {
    expect(faceColor(color, slot)).toBe(expected);
  });

  it("names graphite #2b2d33", () => {
    expect(graphite).toBe("#2b2d33");
  });
});
