import { useEffect, useRef } from "react";

import type { Period } from "@/features/instruments/model/price-period";

export interface Press {
  button: number;
  stopPropagation: () => void;
}

// The engine of the chart keeps no span between two points, and a drag on it pans the window.
// The period is read from the date under the pointer when the press starts and while it moves.
// Workaround for Slotted issue #108: the chart reports no range, only the point under the pointer.
export function usePeriodDrag(onChange: (period: Period | null) => void) {
  const active = useRef<string | null>(null);
  const anchor = useRef<string | null>(null);

  useEffect(() => {
    function handleRelease() {
      if (anchor.current !== null && anchor.current === active.current) {
        onChange(null);
      }
      anchor.current = null;
    }

    window.addEventListener("pointerup", handleRelease);

    return () => {
      window.removeEventListener("pointerup", handleRelease);
    };
  }, [onChange]);

  function handleActiveDate(date: string | null) {
    if (date === null) return;

    active.current = date;
    if (anchor.current !== null) onChange({ from: anchor.current, to: date });
  }

  // Workaround for Slotted issue #107: a press is stopped before the chart, which pans on a drag.
  function handlePointerDown(press: Press) {
    if (press.button !== 0 || active.current === null) return;

    anchor.current = active.current;
    press.stopPropagation();
  }

  function handleKeyDown(key: { key: string }) {
    if (key.key === "Escape") onChange(null);
  }

  return { handleActiveDate, handlePointerDown, handleKeyDown };
}
