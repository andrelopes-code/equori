import { useCallback, useState } from "react";

export type Scheme = "dark" | "light" | "system";

const STORAGE_KEY = "equori.scheme";
const DEFAULT_SCHEME: Scheme = "dark";

function isScheme(value: unknown): value is Scheme {
  return value === "dark" || value === "light" || value === "system";
}

export function readScheme(): Scheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isScheme(stored) ? stored : DEFAULT_SCHEME;
  } catch {
    return DEFAULT_SCHEME;
  }
}

export function applyScheme(scheme: Scheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // The scheme still applies to this page load when storage is unavailable.
  }
  const resolved =
    scheme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : scheme;
  document.documentElement.setAttribute("data-slotted-scheme", resolved);
}

export function useScheme(): [Scheme, (scheme: Scheme) => void] {
  const [scheme, setScheme] = useState<Scheme>(readScheme);
  const update = useCallback((next: Scheme) => {
    applyScheme(next);
    setScheme(next);
  }, []);
  return [scheme, update];
}
