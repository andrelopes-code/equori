import { beforeEach, describe, expect, it } from "vitest";

import { accents, readAccent } from "@/theme/accent";
import {
  amountToneMode,
  amountToneModes,
  summaryAmounts,
  summaryModes,
} from "@/theme/amounts";
import { cornerStyles, readCorners } from "@/theme/corners";
import { densities, readDensity } from "@/theme/density";
import { motion, motions } from "@/theme/motion";
import { readScheme, schemes } from "@/theme/scheme";
import { textScale, textSize } from "@/theme/text-size";
import { typeface, typefaces } from "@/theme/typeface";
import values from "@/theme/appearance-values.json";
import { readVisual } from "@/theme/visual";

// The value sets of the assistant's set_appearance tool, written by
// internal/identity/toolapi (assistant parity design, AP2).
const readers: Record<keyof typeof values, () => string> = {
  scheme: readScheme,
  density: readDensity,
  textSize: textSize.read,
  motion: motion.read,
  corners: readCorners,
  typeface: typeface.read,
  amountTone: amountToneMode.read,
  summaryAmounts: summaryAmounts.read,
  visual: readVisual,
  accent: readAccent,
};

const textSizes = Array.from(
  { length: (textScale.max - textScale.min) / textScale.step + 1 },
  (_, i) => String(textScale.min + i * textScale.step),
);

describe("values of set_appearance", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each(Object.entries(readers))(
    "the web accepts every %s value",
    (name, read) => {
      for (const value of values[name as keyof typeof values]) {
        localStorage.setItem(`equori.${name}`, value);
        expect(read()).toBe(value);
      }
    },
  );

  it("holds every preset the web offers", () => {
    expect(values.scheme).toEqual(schemes);
    expect(values.density).toEqual(densities);
    expect(values.textSize).toEqual(textSizes);
    expect(values.motion).toEqual(motions);
    expect(values.corners).toEqual(cornerStyles);
    expect(values.typeface).toEqual(typefaces);
    expect(values.amountTone).toEqual(amountToneModes);
    expect(values.summaryAmounts).toEqual(summaryModes);
    expect(values.accent).toEqual(accents);
  });
});
