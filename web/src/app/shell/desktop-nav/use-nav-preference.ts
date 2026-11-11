import { useCallback, useState } from "react";

const STORAGE_KEY = "equori.nav";

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "rail";
  } catch {
    return true;
  }
}

// Whether the desktop column is open or narrowed to its rail, kept per browser.
export function useNavPreference(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(read);
  const update = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, next ? "open" : "rail");
    } catch {
      // The choice still holds for this page load when storage is unavailable.
    }
    setOpen(next);
  }, []);
  return [open, update];
}
