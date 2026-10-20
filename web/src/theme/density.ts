import { useCallback, useState } from "react";

export type Density = "comfortable" | "compact" | "dense";

export const densities: readonly Density[] = [
  "comfortable",
  "compact",
  "dense",
];

const STORAGE_KEY = "equori.density";
const DEFAULT_DENSITY: Density = "comfortable";

function isDensity(value: unknown): value is Density {
  return (densities as readonly unknown[]).includes(value);
}

export function readDensity(): Density {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isDensity(stored) ? stored : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

export function applyDensity(density: Density): void {
  try {
    localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // The density still applies to this page load when storage is unavailable.
  }
  document.documentElement.setAttribute("data-slotted-density", density);
}

export function useDensity(): [Density, (density: Density) => void] {
  const [density, setDensity] = useState<Density>(readDensity);
  const update = useCallback((next: Density) => {
    applyDensity(next);
    setDensity(next);
  }, []);
  return [density, update];
}
