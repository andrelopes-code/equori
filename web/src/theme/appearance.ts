import { applyAccent, defaultAccent, readAccent } from "@/theme/accent";
import { applyCorners, defaultCorners, readCorners } from "@/theme/corners";
import { applyDensity, defaultDensity, readDensity } from "@/theme/density";
import { motion } from "@/theme/motion";
import { applyScheme, defaultScheme, readScheme } from "@/theme/scheme";
import { statusNames, statusSeeds } from "@/theme/status";
import { applySurfaces, surfaceDefaults, surfaceNames } from "@/theme/surface";
import { refreshSavedThemes } from "@/theme/theme-file";
import { textSize } from "@/theme/text-size";
import { tone } from "@/theme/tone";
import { typeface } from "@/theme/typeface";
import { applyVisual, defaultVisual, readVisual } from "@/theme/visual";

// The names of every appearance choice; each is stored under `equori.<name>` (BK21).
export const appearanceNames: readonly string[] = [
  "scheme",
  "accent",
  "tone",
  "corners",
  "density",
  "textSize",
  "typeface",
  "motion",
  "visual",
  "themes",
  ...statusNames,
  ...surfaceNames,
];

// Returns every choice of the appearance to the application's own.
export function resetAppearance(): void {
  applyScheme(defaultScheme);
  applyAccent(defaultAccent);
  tone.apply(tone.fallback);
  for (const seed of Object.values(statusSeeds)) seed.apply(seed.fallback);
  applyCorners(defaultCorners);
  applyDensity(defaultDensity);
  textSize.apply(textSize.fallback);
  typeface.apply(typeface.fallback);
  motion.apply(motion.fallback);
  applyVisual(defaultVisual);
  applySurfaces(surfaceDefaults);
}

// The names present in localStorage.
export function storedAppearance(): Record<string, string> {
  const stored: Record<string, string> = {};
  for (const name of appearanceNames) {
    try {
      const value = localStorage.getItem(`equori.${name}`);
      if (value !== null) stored[name] = value;
    } catch {
      // Storage is unavailable: the choice is not stored.
    }
  }
  return stored;
}

// Writes each string value of a known name to localStorage, then repaints every choice from
// storage; a value its check refuses reads as the choice's fallback.
export function restoreAppearance(values: Record<string, unknown>): void {
  for (const name of appearanceNames) {
    const value = values[name];
    if (typeof value !== "string") continue;
    try {
      localStorage.setItem(`equori.${name}`, value);
    } catch {
      // Storage is unavailable: the repaint below reads the fallback.
    }
  }
  applyScheme(readScheme());
  applyAccent(readAccent());
  tone.apply(tone.read());
  for (const seed of Object.values(statusSeeds)) seed.apply(seed.read());
  applyCorners(readCorners());
  applyDensity(readDensity());
  textSize.apply(textSize.read());
  typeface.apply(typeface.read());
  motion.apply(motion.read());
  applyVisual(readVisual());
  applySurfaces();
  refreshSavedThemes();
}
