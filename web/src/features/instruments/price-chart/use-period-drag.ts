import { useEffect, useRef } from "react";

import type { Period } from "@/features/instruments/model/price-period";

export interface Press {
  button: number;
  clientX: number;
  stopPropagation: () => void;
}

// A press released within this many pixels of where it started is a click, not a drag.
const clickSlop = 4;

// The engine of the chart keeps no span between two points, and a drag on it pans the window.
// The period is read from the date under the pointer when the press starts and while it moves.
// Workaround for Slotted issue #108: the chart reports no range, only the point under the pointer.
export function usePeriodDrag(onChange: (period: Period | null) => void) {
  const active = useRef<string | null>(null);
  const anchor = useRef<string | null>(null);
  const downX = useRef(0);

  useEffect(() => {
    function handleRelease(event: MouseEvent) {
      if (anchor.current === null) return;

      if (Math.abs(event.clientX - downX.current) < clickSlop) onChange(null);
      anchor.current = null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onChange(null);
    }

    window.addEventListener("pointerup", handleRelease);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerup", handleRelease);
      window.removeEventListener("keydown", handleKeyDown);
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
    downX.current = press.clientX;
    press.stopPropagation();
  }

  return { handleActiveDate, handlePointerDown };
}
