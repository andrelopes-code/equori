import { useEffect, useRef } from "react";
import type { RefObject } from "react";

interface PanelFocus {
  open: boolean;
  beside: boolean;
  phone: boolean;
  canType: boolean;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  returnFocus: RefObject<HTMLElement | null> | undefined;
}

export function usePanelFocus({
  open,
  beside,
  phone,
  canType,
  composerRef,
  returnFocus,
}: PanelFocus): void {
  // The composer is disabled while the chat state loads, when the drawer moves focus on open.
  // A move between the drawer and the pane mounts a new composer; it takes focus again. A phone's
  // sheet leaves it unfocused: the screen keyboard would resize the sheet during its entrance.
  useEffect(() => {
    if (canType && !phone) composerRef.current?.focus();
  }, [canType, beside, phone, composerRef]);

  // The pane moves no focus on close; the element focused before opening takes it back (P18).
  const wasOpen = useRef(open);

  useEffect(() => {
    if (wasOpen.current && !open && beside) returnFocus?.current?.focus();

    wasOpen.current = open;
  }, [open, beside, returnFocus]);
}
