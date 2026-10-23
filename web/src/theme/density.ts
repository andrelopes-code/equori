import { useSyncExternalStore } from "react";

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

const listeners = new Set<() => void>();
// Holds the choice for this page load only while storage refuses the write.
let held: Density | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): Density {
  return held ?? readDensity();
}

export function applyDensity(density: Density): void {
  try {
    localStorage.setItem(STORAGE_KEY, density);
    held = undefined;
  } catch {
    // The density still applies to this page load when storage is unavailable.
    held = density;
  }
  document.documentElement.setAttribute("data-slotted-density", density);
  listeners.forEach((listener) => {
    listener();
  });
}

// Every reader sees the choice at once, so the menu and the settings page never disagree.
export function useDensity(): [Density, (density: Density) => void] {
  return [useSyncExternalStore(subscribe, snapshot), applyDensity];
}
