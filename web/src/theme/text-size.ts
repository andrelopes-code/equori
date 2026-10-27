import { useSyncExternalStore } from "react";

import { preference } from "@/theme/preference";

// The root font size, as a percentage of the browser's own, written as a decimal string. The
// theme's type and space scales are in rem, so text and the gaps around it grow together; control
// heights are in pixels and follow the density.
export type TextSize = `${number}`;

export const textScale = { min: 85, max: 140, step: 5, standard: 100 } as const;

function isTextSize(value: string): boolean {
  const scale = Number(value);
  return (
    /^\d{2,3}$/.test(value) &&
    scale >= textScale.min &&
    scale <= textScale.max &&
    scale % textScale.step === 0
  );
}

export const textSize = preference<TextSize>(
  "equori.textSize",
  isTextSize,
  "100",
  (value) => {
    const root = document.documentElement.style;
    if (value === textSize.fallback) root.removeProperty("font-size");
    else root.setProperty("font-size", `${value}%`);
  },
);

export function useTextSize(): [TextSize, (value: TextSize) => void] {
  return [
    useSyncExternalStore(textSize.subscribe, textSize.snapshot),
    textSize.apply,
  ];
}
