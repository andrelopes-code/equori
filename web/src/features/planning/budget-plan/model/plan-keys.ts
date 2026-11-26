import type { KeyboardEvent } from "react";

// The keyboard shortcut a key press asks for in the Plan view (spec 5.2): Ctrl or Cmd with S
// saves, with Z undoes outside a text input.
export function planShortcut(
  event: KeyboardEvent,
  editable: boolean,
  canUndo: boolean,
): "save" | "undo" | null {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (mod && key === "s" && editable) return "save";
  if (
    mod &&
    key === "z" &&
    !(event.target instanceof HTMLInputElement) &&
    canUndo
  )
    return "undo";
  return null;
}
