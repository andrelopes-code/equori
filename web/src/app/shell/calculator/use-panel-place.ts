import { useState } from "react";

import { readPlace, writePlace } from "@/app/shell/calculator/window-place";
import type { Place } from "@/app/shell/calculator/window-place";

// The place of the window, kept per browser (K5); null until the window is moved, so the panel
// opens in its corner (K7).
export function usePanelPlace() {
  const [place, setPlace] = useState<Place | null>(readPlace);

  function handlePlaceChange(next: Place) {
    setPlace(next);
    writePlace(next);
  }

  return { place, handlePlaceChange };
}
