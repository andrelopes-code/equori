import { useState } from "react";

// Per-browser convenience: a section stays collapsed under storageKey until the reader opens it.
export function useStoredCollapsed(
  storageKey: string,
): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => read(storageKey));

  function change(next: boolean) {
    setCollapsed(next);
    write(storageKey, next);
  }

  return [collapsed, change];
}

function read(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function write(storageKey: string, collapsed: boolean) {
  try {
    localStorage.setItem(storageKey, String(collapsed));
  } catch {
    // A browser that refuses storage keeps the choice for this visit.
  }
}
