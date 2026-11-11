import { useCallback, useState } from "react";

const STORAGE_KEY = "equori.overview.firstSteps";

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dismissed";
  } catch {
    return false;
  }
}

// Whether the reader dismissed the first steps, kept per browser as the overview's layout is.
export function useFirstStepsDismissal(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(read);
  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // The choice still holds for this page load when storage is unavailable.
    }
    setDismissed(true);
  }, []);
  return [dismissed, dismiss];
}
