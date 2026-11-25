import { type KeyboardEvent, useState } from "react";

// A field that saves when it loses focus or on Enter, and goes back to the saved value on Escape. The
// typed value stays while its save is on the way or failed; onSave answers false to go back to the saved
// one.
export function useSavedField<T>(saved: T, onSave: (value: T) => boolean) {
  const [draft, setDraft] = useState<{ value: T }>();
  const [seen, setSeen] = useState(saved);

  if (saved !== seen) {
    setSeen(saved);
    setDraft(undefined);
  }

  function handleBlur() {
    if (draft === undefined || draft.value === saved) return;
    if (!onSave(draft.value)) setDraft(undefined);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && draft !== undefined) {
      event.preventDefault();
      setDraft(undefined);
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleBlur();
    }
  }

  return {
    value: draft === undefined ? saved : draft.value,
    onChange: (value: T) => {
      setDraft({ value });
    },
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  };
}
