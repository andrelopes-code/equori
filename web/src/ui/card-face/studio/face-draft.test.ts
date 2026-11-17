import { describe, expect, it } from "vitest";

import { graphite } from "@/ui/card-face/face-color";
import {
  emptyFace,
  faceAppearance,
  faceBody,
  faceIsEmpty,
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

describe("faceAppearance", () => {
  it("lets a stored colour win over the logo colour", () => {
    expect(faceAppearance({ color: "#fce300" }, 1, "#111111").color).toBe(
      "#fce300",
    );
  });

  it("takes the logo colour when no colour is stored", () => {
    expect(faceAppearance({ color: null }, 1, "#111111").color).toBe("#111111");
  });

  it("takes the slot colour when the logo has none", () => {
    expect(faceAppearance(undefined, 1, undefined).color).toBe("#7368d4");
  });

  it("takes graphite when neither a logo nor a slot gives a colour", () => {
    expect(faceAppearance(undefined, undefined, undefined)).toEqual({
      color: graphite,
    });
  });

  it("passes the stored art, chip, orientation and brand through", () => {
    expect(
      faceAppearance(
        {
          color: "#fce300",
          art: "waves",
          chip: "gold",
          orientation: "vertical",
          brand: "plate",
        },
        undefined,
        undefined,
      ),
    ).toEqual({
      color: "#fce300",
      art: "waves",
      chip: "gold",
      orientation: "vertical",
      brand: "plate",
    });
  });

  it("leaves a null value out", () => {
    expect(
      faceAppearance({ color: "#fce300", art: null, chip: null }, 1, undefined),
    ).toEqual({ color: "#fce300" });
  });
});

describe("faceIsEmpty", () => {
  it("is true when every value is null", () => {
    expect(faceIsEmpty(emptyFace)).toBe(true);
  });

  it.each([
    { color: "#fce300" },
    { art: "waves" },
    { chip: "silver" as const },
    { orientation: "vertical" as const },
    { brand: "none" as const },
  ])("is false when %o is set", (patch) => {
    expect(faceIsEmpty({ ...emptyFace, ...patch })).toBe(false);
  });
});
