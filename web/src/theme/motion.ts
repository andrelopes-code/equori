import { useSyncExternalStore } from "react";

import { preference } from "@/theme/preference";

// system follows the operating system's reduced-motion setting, which the theme already reads;
// reduced shortens every transition of the theme whatever that setting says.
export type Motion = "system" | "reduced";

export const motions: readonly Motion[] = ["system", "reduced"];

// The value the theme itself writes under prefers-reduced-motion.
const durations = ["instant", "short", "medium", "long"] as const;

export const motion = preference<Motion>(
  "equori.motion",
  motions,
  "system",
  (value) => {
    const root = document.documentElement.style;
    for (const step of durations) {
      const property = `--slotted-duration-${step}`;
      if (value === motion.fallback) root.removeProperty(property);
      else root.setProperty(property, "1ms");
    }
  },
);

export function useMotion(): [Motion, (value: Motion) => void] {
  return [
    useSyncExternalStore(motion.subscribe, motion.snapshot),
    motion.apply,
  ];
}
