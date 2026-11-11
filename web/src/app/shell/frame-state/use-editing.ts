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
// apps do, instead of riding the bar on top of the keys. A press moves focus when it starts: the
// state waits for the press to end, so the bar does not return under the finger and move the
// control being tapped.
export function useEditing(): boolean {
  const [editing, setEditing] = useState(() =>
    takesText(document.activeElement),
  );
  useEffect(() => {
    let pressing = false;
    const update = () => {
      if (!pressing) setEditing(takesText(document.activeElement));
    };
    const press = () => {
      pressing = true;
    };
    const release = () => {
      pressing = false;
      update();
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
    };
  }, []);
  return editing;
}
