import { seedStyle } from "@slotted/theme/seeds";
import { useSyncExternalStore } from "react";

export type Accent =
  | "indigo"
  | "violet"
  | "pink"
  | "rose"
  | "orange"
  | "emerald"
  | "cyan"
  | "blue";

// The accent seed of each choice. Every accent token derives from it within the theme's contrast
// bounds, so a choice keeps the ratios of every scheme. indigo is the seed of equori.theme.ts.
export const accentSeeds: Readonly<Record<Accent, string>> = {
  indigo: "#7c6cff",
  violet: "#a855f7",
  pink: "#ec4899",
  rose: "#f43f5e",
  orange: "#f97316",
  emerald: "#10b981",
  cyan: "#06b6d4",
  blue: "#3b82f6",
};

export const accents = Object.keys(accentSeeds) as readonly Accent[];

const STORAGE_KEY = "equori.accent";
const DEFAULT_ACCENT: Accent = "indigo";

function isAccent(value: unknown): value is Accent {
  return (accents as readonly unknown[]).includes(value);
}

export function readAccent(): Accent {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isAccent(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

const listeners = new Set<() => void>();
// Holds the choice for this page load only while storage refuses the write.
let held: Accent | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): Accent {
  return held ?? readAccent();
}

// The seed is written on the root, the element that carries data-slotted-theme, so both the
// standard and the glass theme derive from it.
export function applyAccent(accent: Accent): void {
  try {
    localStorage.setItem(STORAGE_KEY, accent);
    held = undefined;
  } catch {
    // The accent still applies to this page load when storage is unavailable.
    held = accent;
  }
  const root = document.documentElement.style;
  for (const [property, value] of Object.entries(
    seedStyle({ accent: accentSeeds[accent] }),
  )) {
    if (accent === DEFAULT_ACCENT) root.removeProperty(property);
    else root.setProperty(property, value);
  }
  listeners.forEach((listener) => {
    listener();
  });
}

// Every reader sees the choice at once.
export function useAccent(): [Accent, (accent: Accent) => void] {
  return [useSyncExternalStore(subscribe, snapshot), applyAccent];
}
