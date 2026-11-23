import { useState } from "react";
import type { KeyboardEvent } from "react";

import {
  clampPlace,
  readPlace,
  writePlace,
} from "@/app/shell/calculator/window-place";
import type { Place } from "@/app/shell/calculator/window-place";

// K8: one press of an arrow key, and with Shift.
const STEP = 16;
const LONG_STEP = 64;

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// The place of the window, kept per browser (K5); null until the window is moved, so the panel
// opens in its corner (K7).
export function usePanelPlace() {
  const [place, setPlace] = useState<Place | null>(readPlace);

  function handlePlaceChange(next: Place) {
    setPlace(next);
    writePlace(next);
  }

  // Workaround for Slotted issue #132: the grip moves 8 px (32 px with Shift) and takes no step, so
  // the arrow keys on it are answered here.
  function handleKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
    const arrow = ARROWS[event.key];
    const onGrip =
      event.target instanceof Element &&
      event.target.closest('[data-part="grip"]') !== null;
    if (arrow === undefined || !onGrip) return;

    event.preventDefault();
    event.stopPropagation();

    const box = event.currentTarget.getBoundingClientRect();
    const page = document.documentElement;
    const step = event.shiftKey ? LONG_STEP : STEP;

    handlePlaceChange(
      clampPlace(
        {
          x: (place?.x ?? box.left) + arrow[0] * step,
          y: (place?.y ?? box.top) + arrow[1] * step,
        },
        { width: box.width, height: box.height },
        { width: page.clientWidth, height: page.clientHeight },
      ),
    );
  }

  return { place, handlePlaceChange, handleKeyDownCapture };
}
