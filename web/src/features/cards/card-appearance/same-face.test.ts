import { describe, expect, it } from "vitest";

import { sameFace } from "@/features/cards/card-appearance/same-face";
import { emptyFace } from "@/ui/card-face/studio/face-draft";
import type { FaceDraft } from "@/ui/card-face/studio/face-draft";

describe("sameFace", () => {
  const cases: [string, FaceDraft, FaceDraft, boolean][] = [
    ["two empty faces", emptyFace, emptyFace, true],
    [
      "a colour in another case",
      { ...emptyFace, color: "#FCE300" },
      { ...emptyFace, color: "#fce300" },
      true,
    ],
    [
      "another colour",
      { ...emptyFace, color: "#fce300" },
      { ...emptyFace, color: "#820ad1" },
      false,
    ],
    [
      "a colour against none",
      { ...emptyFace, color: "#fce300" },
      emptyFace,
      false,
    ],
    ["another art", { ...emptyFace, art: "waves" }, emptyFace, false],
    ["another chip", { ...emptyFace, chip: "silver" }, emptyFace, false],
    [
      "another orientation",
      { ...emptyFace, orientation: "vertical" },
      emptyFace,
      false,
    ],
    ["another brand", { ...emptyFace, brand: "none" }, emptyFace, false],
  ];

  it.each(cases)("%s", (_name, a, b, expected) => {
    expect(sameFace(a, b)).toBe(expected);
  });
});
