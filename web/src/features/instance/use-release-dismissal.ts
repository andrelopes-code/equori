import { useCallback, useState } from "react";

const STORAGE_KEY = "equori.overview.dismissedRelease";

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// The release version the reader dismissed, kept per browser; a later release shows again.
export function useReleaseDismissal(): [
  string | null,
  (version: string) => void,
] {
  const [dismissed, setDismissed] = useState(read);
  const dismiss = useCallback((version: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch {
      // The choice still holds for this page load when storage is unavailable.
    }
    setDismissed(version);
  }, []);
  return [dismissed, dismiss];
}
