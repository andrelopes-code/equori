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

    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, [open, field]);
}
