import { describe, expect, it } from "vitest";

import { brandOf, type Brand } from "@/ui/card-face/brand";
import type { LogoTraits } from "@/ui/card-face/logo-traits";

const transparent = (color: string): LogoTraits => ({ color, opaque: false });

describe("brandOf", () => {
  it.each<[Brand, unknown]>([
    ["none", { kind: "none" }],
    ["name", { kind: "name" }],
    ["plate", { kind: "plate", tone: "light" }],
  ])("%s ignores the logo", (brand, expected) => {
    expect(brandOf(brand, true, transparent("#820ad1"), "#820ad1")).toEqual(
      expected,
    );
  });

  it("draws a light plate for auto without a logo", () => {
    expect(brandOf("auto", false, undefined, "#820ad1")).toEqual({
      kind: "plate",
      tone: "light",
    });
  });

  it("draws a light plate for auto with a logo and no traits", () => {
    expect(brandOf("auto", true, undefined, "#820ad1")).toEqual({
      kind: "plate",
      tone: "light",
    });
  });

  it("draws a tile for auto with an opaque logo", () => {
    const traits: LogoTraits = { color: "#ff7a00", opaque: true };

    expect(brandOf("auto", true, traits, "#820ad1")).toEqual({ kind: "tile" });
  });

  it.each<[string, string, string, unknown]>([
    [
      "purple logo on purple face",
      "#820ad1",
      "#820ad1",
      { kind: "plate", tone: "light" },
    ],
    ["purple logo on yellow face", "#820ad1", "#fce300", { kind: "bare" }],
    [
      "dark logo on dark face",
      "#1b1b1f",
      "#17171a",
      { kind: "plate", tone: "light" },
    ],
    [
      "white-ish logo on white face",
      "#f0f0ee",
      "#ffffff",
      { kind: "plate", tone: "dark" },
    ],
  ])("auto with transparent corners: %s", (_name, logo, face, expected) => {
    expect(brandOf("auto", true, transparent(logo), face)).toEqual(expected);
  });
});
