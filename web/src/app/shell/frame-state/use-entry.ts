import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { readEntryForm } from "@/features/transactions";

const editable =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const overlay = '[role="dialog"], [role="alertdialog"], [role="menu"]';

// Opens the entry form the owner used last: the transaction form or the text (A115).
export function useEntry(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    void navigate({
      to:
        readEntryForm() === "text"
          ? "/transactions/capture"
          : "/transactions/new",
    });
  }, [navigate]);
}

// A closed popover (a chart's toolbar menu) stays in the document with the role of its content
// and holds nobody; jsdom has no :popover-open and reads as closed.
function overlayOpen(): boolean {
  return [...document.querySelectorAll(overlay)].some((element) => {
    if (!element.hasAttribute("popover")) return true;
    try {
      return element.matches(":popover-open");
    } catch {
      return false;
    }
  });
}

// A single key opens a command from any authenticated route, unless a field takes the key, a
// modifier makes it a command, or an overlay holds the reader.
export function useKeyShortcut(key: string, open: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key) return;
      if (event.isComposing || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest(editable)) {
        return;
      }
      if (overlayOpen()) return;
      event.preventDefault();
      open();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [key, open]);
}

// N opens the entry.
export function useEntryShortcut(open: () => void): void {
  useKeyShortcut("n", open);
}
