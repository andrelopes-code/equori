import { seedStyle } from "@slotted/theme/seeds";
import { useSyncExternalStore } from "react";

import { preference } from "@/theme/preference";

export type TonePreset = "graphite" | "slate" | "zinc" | "stone" | "sage";

// A preset, or a colour the reader picked, written as #rrggbb.
export type Tone = TonePreset | `#${string}`;

// The neutral seed of each choice: surfaces, text and borders derive from it within the theme's
// contrast bounds. graphite is the neutral seed of equori.theme.ts.
export const toneSeeds: Readonly<Record<TonePreset, string>> = {
  graphite: "#6f6f86",
  slate: "#64748b",
  zinc: "#71717a",
  stone: "#78716c",
  sage: "#6b7a6f",
};

export const tones = Object.keys(toneSeeds) as readonly TonePreset[];

function isPreset(value: string): value is TonePreset {
  return (tones as readonly string[]).includes(value);
}

export function toneSeed(value: Tone): string {
  return isPreset(value) ? toneSeeds[value] : value;
}

export const tone = preference<Tone>(
  "equori.tone",
  (value) => isPreset(value) || /^#[0-9a-f]{6}$/.test(value),
  "graphite",
  (value) => {
    const root = document.documentElement.style;
    for (const [property, seed] of Object.entries(
      seedStyle({ neutral: toneSeed(value) }),
    )) {
      if (value === tone.fallback) root.removeProperty(property);
      else root.setProperty(property, seed);
    }
  },
);

export function useTone(): [Tone, (value: Tone) => void] {
  return [useSyncExternalStore(tone.subscribe, tone.snapshot), tone.apply];
}
