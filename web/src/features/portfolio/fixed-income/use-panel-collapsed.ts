import { useState } from "react";

const storageKey = "equori.portfolio.fixedIncome.collapsed";

// Per-browser convenience: the panel stays minimized until the reader expands it.
export function usePanelCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(read);

  function change(next: boolean) {
    setCollapsed(next);
    write(next);
  }

  return [collapsed, change];
}

function read(): boolean {
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function write(collapsed: boolean) {
  try {
    localStorage.setItem(storageKey, String(collapsed));
  } catch {
    // A browser that refuses storage keeps the choice for this visit.
  }
}
