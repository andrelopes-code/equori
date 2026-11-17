import { describe, expect, it } from "vitest";

import {
  emptyFace,
  faceBody,
  faceOf,
  faceProps,
  presetColors,
} from "@/ui/card-face/studio/face-draft";

describe("faceOf", () => {
  it("reads every value of the stored face", () => {
    const face = {
      color: "#820ad1",
      art: "waves",
      chip: "silver",
      orientation: "vertical",
      brand: "plate",
    } as const;

    expect(faceOf({ face })).toEqual(face);
  });

  it("reads a missing face and missing values as null", () => {
    expect(faceOf({})).toEqual(emptyFace);
    expect(faceOf({ face: { art: "dots" } })).toEqual({
      ...emptyFace,
      art: "dots",
    });
  });
});

describe("faceBody", () => {
  it("lower-cases the colour and keeps the nulls", () => {
    expect(faceBody({ ...emptyFace, color: "#0B4EA2" })).toEqual({
      color: "#0b4ea2",
      art: null,
      chip: null,
      orientation: null,
      brand: null,
    });
  });
});

describe("faceProps", () => {
  it("falls back to the suggested colour and leaves the rest undefined", () => {
    expect(faceProps(emptyFace, "#820ad1")).toEqual({
      color: "#820ad1",
      art: undefined,
      chip: undefined,
      orientation: undefined,
      brand: undefined,
    });
  });

  it("takes the values of the draft", () => {
    const draft = {
      color: "#fce300",
      art: "holo",
      chip: "silver",
      orientation: "vertical",
      brand: "none",
    } as const;

    expect(faceProps(draft, "#820ad1")).toEqual(draft);
  });
});

describe("presetColors", () => {
  it("lists the twelve presets in lower case", () => {
    expect(presetColors.map(({ key }) => key)).toEqual([
      "purple",
      "orange",
      "bright_orange",
      "red",
      "yellow",
      "blue",
      "green",
      "pink",
      "carbon",
      "graphite",
      "silver",
      "gold",
    ]);
    expect(presetColors.every(({ hex }) => /^#[0-9a-f]{6}$/.test(hex))).toBe(
      true,
    );
  });
});
