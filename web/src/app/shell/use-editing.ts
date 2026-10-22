import { useEffect, useState } from "react";

const textInputTypes = new Set([
  "",
  "text",
  "search",
  "email",
  "number",
  "password",
  "tel",
  "url",
]);

// Whether focus is on an element a phone answers with its on-screen keyboard.
function takesText(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return textInputTypes.has(element.getAttribute("type") ?? "");
  }
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  const mode = element.getAttribute("inputmode");
  return mode !== null && mode !== "none";
}

// True while a field that raises the on-screen keyboard has focus. The viewport resizes with the
// keyboard (index.html), so the phone gives up its navigation bar for that time, as Android
// apps do, instead of riding the bar on top of the keys.
export function useEditing(): boolean {
  const [editing, setEditing] = useState(() =>
    takesText(document.activeElement),
  );
  useEffect(() => {
    const update = () => {
      setEditing(takesText(document.activeElement));
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  return editing;
}
