import { useEffect } from "react";

const editable =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const overlay = '[role="dialog"], [role="alertdialog"]';

// Ledger sheet L7 and complete frontend F2: N opens the quick entry from any authenticated
// route, unless a field takes the key, a modifier makes it a command, or an overlay is open.
export function useNewShortcut(open: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n") return;
      if (event.isComposing || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest(editable)) {
        return;
      }
      if (document.querySelector(overlay) !== null) return;
      event.preventDefault();
      open();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
}
