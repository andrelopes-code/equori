import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { OverlayOpenContext } from "@/ui/use-overlay-open";

// Workaround for Slotted finding "a dialog or drawer mounted open plays no enter transition, and
// one unmounted on close plays no exit". The overlay is first rendered closed and opened from an
// effect, so the family runs its enter; on close it stays rendered, closed, with the last value,
// so the family runs its exit. Each opening takes a new key, so the overlay's own state starts
// fresh.
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
  const [open, setOpen] = useState(false);
  if (value !== seen) {
    setSeen(value);
    setOpen(false);
    if (value !== undefined) {
      setShown((prev) => ({ value, key: (prev?.key ?? 0) + 1 }));
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the second render, after the closed one is committed, is what lets the family play its enter.
    if (value !== undefined) setOpen(true);
  }, [value]);
  return shown === null ? null : (
    <OverlayOpenContext key={shown.key} value={open && value !== undefined}>
      {children(shown.value)}
    </OverlayOpenContext>
  );
}
