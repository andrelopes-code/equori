import { describe, expect, it } from "vitest";

import { appearanceSummary } from "@/features/cards/card-appearance/appearance-summary";
import { emptyFace } from "@/ui/card-face/studio/face-draft";

describe("appearanceSummary", () => {
  it("names the suggested colour and the defaults of an empty face", () => {
    expect(appearanceSummary(emptyFace, "#820ad1")).toEqual({
      color: "cardFace.color.purple",
      hex: "#820AD1",
      art: "cardFace.art.plain",
      chip: "cardFace.studio.chip.gold",
    });
  });

  it("names the stored colour, art and chip", () => {
    const face = {
      ...emptyFace,
      color: "#fce300",
      art: "waves",
      chip: "silver" as const,
    };

    expect(appearanceSummary(face, "#820ad1")).toEqual({
      color: "cardFace.color.yellow",
      hex: "#FCE300",
      art: "cardFace.art.waves",
      chip: "cardFace.studio.chip.silver",
    });
  });

  it("calls a colour outside the presets custom", () => {
    const summary = appearanceSummary(
      { ...emptyFace, color: "#123456" },
      "#820ad1",
    );

    expect(summary.color).toBe("cardFace.studio.custom");
    expect(summary.hex).toBe("#123456");
  });
});
