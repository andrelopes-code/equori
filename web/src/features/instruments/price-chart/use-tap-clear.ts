import type { PointerEvent } from "react";

import type { Period } from "@/features/instruments/model/price-period";

// A touch released within this many pixels of where it started is a tap, not a drag.
const tapSlop = 8;

// Workaround for Slotted issue #108: a tap starts a range at the last point the chart read and
// ends it under the finger, where a click clears it. The tap clears the period once the chart has
// answered it.
export function useTapClear(onChange: (period: Period | null) => void) {
  return (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") return;

    const { clientX, clientY } = event;

    window.addEventListener(
      "pointerup",
      (up) => {
        const moved = Math.hypot(up.clientX - clientX, up.clientY - clientY);
        if (moved >= tapSlop) return;

        setTimeout(() => {
          onChange(null);
        }, 350);
      },
      { once: true },
    );
  };
}
