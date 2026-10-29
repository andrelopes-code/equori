import { applyAccent, defaultAccent } from "@/theme/accent";
import { applyCorners, defaultCorners } from "@/theme/corners";
import { applyDensity, defaultDensity } from "@/theme/density";
import { motion } from "@/theme/motion";
import { applyScheme, defaultScheme } from "@/theme/scheme";
import { statusSeeds } from "@/theme/status";
import { applySurfaces, surfaceDefaults } from "@/theme/surface";
import { textSize } from "@/theme/text-size";
import { tone } from "@/theme/tone";
import { typeface } from "@/theme/typeface";
import { applyVisual, defaultVisual } from "@/theme/visual";

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
