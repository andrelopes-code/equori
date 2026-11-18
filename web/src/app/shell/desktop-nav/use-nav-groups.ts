import { useCallback, useState } from "react";

const STORAGE_KEY = "equori.nav.groups";

// The destinations whose views the reader left open in the desktop column, kept per browser.
export function useNavGroups(): [
  readonly string[],
  (open: readonly string[]) => void,
] {
  const [open, setOpen] = useState(read);
  const update = useCallback((next: readonly string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The choice still holds for this page load when storage is unavailable.
    }

    setOpen(next);
  }, []);

  return [open, update];
}

function read(): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );

    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}
