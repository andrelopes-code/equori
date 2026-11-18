import { useEffect } from "react";

const editable =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

// The slash reaches the search of the help from any of its pages, unless a field takes the key
// or a modifier makes it a command (help spec, HP10).
export function useSlashKey(onSlash: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.isComposing || event.defaultPrevented) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest(editable)) {
        return;
      }

      event.preventDefault();
      onSlash();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onSlash]);
}
