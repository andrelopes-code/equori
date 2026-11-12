import { useState } from "react";

const storageKey = "equori.transactions.showVoided";

// Per-browser convenience: voided transactions stay out of the list until the reader asks for them.
export function useShowVoided(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(read);

  function change(next: boolean) {
    setShow(next);
    write(next);
  }

  return [show, change];
}

function read(): boolean {
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function write(show: boolean) {
  try {
    localStorage.setItem(storageKey, String(show));
  } catch {
    // A browser that refuses storage keeps the choice for this visit.
  }
}
