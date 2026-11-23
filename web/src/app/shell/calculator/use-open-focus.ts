import { useEffect } from "react";
import type { RefObject } from "react";

// K3: opening moves the focus to the account; closing returns it to the element that held it.
export function useOpenFocus(
  open: boolean,
  field: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;

    const before = document.activeElement;
    field.current?.focus();
    // Workaround for Slotted issue #132: the panel is hidden until it reads its own size, after
    // this effect, so the first opening takes the focus on the next frame.
    const frame = requestAnimationFrame(() => field.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, [open, field]);
}
