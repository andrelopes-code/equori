import { useState } from "react";
import type { ReactNode } from "react";

import { OverlayOpenContext } from "@/ui/use-overlay-open";

// An overlay stays rendered after it closes, closed and with its last value, so the family plays
// its exit. Each opening takes a new key, so the overlay's own state starts fresh.
export function Presence<T>({
  value,
  children,
}: {
  // The subject of the overlay, compared by identity: an id or a state value, never data rebuilt
  // on each render. undefined closes it.
  value: T | undefined;
  children: (value: T) => ReactNode;
}) {
  const [seen, setSeen] = useState<T | undefined>(undefined);
  const [shown, setShown] = useState<{ value: T; key: number } | null>(null);
  if (value !== seen) {
    setSeen(value);
    if (value !== undefined) {
      setShown((prev) => ({ value, key: (prev?.key ?? 0) + 1 }));
    }
  }
  return shown === null ? null : (
    <OverlayOpenContext key={shown.key} value={value !== undefined}>
      {children(shown.value)}
    </OverlayOpenContext>
  );
}
