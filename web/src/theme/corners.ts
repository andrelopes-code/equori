import { useSyncExternalStore } from "react";

export type Corners = "square" | "soft" | "standard" | "round";

export const cornerStyles: readonly Corners[] = [
  "square",
  "soft",
  "standard",
  "round",
];

const STORAGE_KEY = "equori.corners";
export const defaultCorners: Corners = "standard";

function isCorners(value: unknown): value is Corners {
  return (cornerStyles as readonly unknown[]).includes(value);
}

export function readCorners(): Corners {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isCorners(stored) ? stored : defaultCorners;
  } catch {
    return defaultCorners;
  }
}

const listeners = new Set<() => void>();
// Holds the choice for this page load only while storage refuses the write.
let held: Corners | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): Corners {
  return held ?? readCorners();
}

export function applyCorners(corners: Corners): void {
  try {
    localStorage.setItem(STORAGE_KEY, corners);
    held = undefined;
  } catch {
    // The corners still apply to this page load when storage is unavailable.
    held = corners;
  }
  document.documentElement.setAttribute("data-slotted-corners", corners);
  listeners.forEach((listener) => {
    listener();
  });
}

// Every reader sees the choice at once.
export function useCorners(): [Corners, (corners: Corners) => void] {
  return [useSyncExternalStore(subscribe, snapshot), applyCorners];
}
