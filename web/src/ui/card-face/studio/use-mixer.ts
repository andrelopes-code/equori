import { useState } from "react";

import { hexToOklch, oklchToHex } from "@/ui/card-face/studio/oklch";
import type { Axis, Mix } from "@/ui/card-face/studio/mixer-axes";

export interface Mixer {
  mix: Mix;
  move: (axis: Axis, value: number) => void;
}

// Hue and chroma stay in state: a grey colour has no hue in the hex, and the slider keeps its
// place. A colour that arrives from outside (preset, hex field, restore) replaces the mix.
export function useMixer(color: string, onColor: (hex: string) => void): Mixer {
  const [mix, setMix] = useState(() => hexToOklch(color));
  const [known, setKnown] = useState(color);

  if (color !== known) {
    setKnown(color);
    setMix(hexToOklch(color));
  }

  function move(axis: Axis, value: number) {
    const next = { ...mix, [axis]: value };
    const hex = oklchToHex(next.l, next.c, next.h);

    setMix(next);
    setKnown(hex);
    onColor(hex);
  }

  return { mix, move };
}
