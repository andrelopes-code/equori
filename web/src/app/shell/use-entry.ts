import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

const editable =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const overlay = '[role="dialog"], [role="alertdialog"], [role="menu"]';

// Opens the form of a new transaction.
export function useEntry(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    void navigate({ to: "/transactions/new" });
  }, [navigate]);
}

// N opens the entry from any authenticated route, unless a field takes the key, a modifier
// makes it a command, or an overlay holds the reader.
export function useEntryShortcut(open: () => void): void {
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
