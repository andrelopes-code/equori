import { useSyncExternalStore } from "react";

export type Corners = "square" | "soft" | "standard" | "round";

export const cornerStyles: readonly Corners[] = [
  "square",
  "soft",
  "standard",
  "round",
];

type Step = "xs" | "sm" | "md" | "lg";

// The radius scale of each choice, in pixels. standard repeats the theme's own scale for the
// preview; applying it removes the properties, so the theme's scale stays in force. radius-full is
// left out, so a pill and an avatar stay round under every choice.
export const cornerScales: Readonly<
  Record<Corners, Readonly<Record<Step, number>>>
> = {
  square: { xs: 0, sm: 0, md: 0, lg: 0 },
  soft: { xs: 1, sm: 2, md: 3, lg: 4 },
  standard: { xs: 2, sm: 4, md: 6, lg: 8 },
  round: { xs: 4, sm: 8, md: 12, lg: 16 },
};

const steps: readonly Step[] = ["xs", "sm", "md", "lg"];

const STORAGE_KEY = "equori.corners";
const DEFAULT_CORNERS: Corners = "standard";

function isCorners(value: unknown): value is Corners {
  return (cornerStyles as readonly unknown[]).includes(value);
}

export function readCorners(): Corners {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isCorners(stored) ? stored : DEFAULT_CORNERS;
  } catch {
    return DEFAULT_CORNERS;
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

// Workaround for Slotted finding "No runtime axis for the corner radius": density has an
// attribute a reader's choice sets, corners have none, so the radius tokens are written on the
// root. Every family reads them through var(), --slotted-control-radius included.
export function applyCorners(corners: Corners): void {
  try {
    localStorage.setItem(STORAGE_KEY, corners);
    held = undefined;
  } catch {
    // The corners still apply to this page load when storage is unavailable.
    held = corners;
  }
  const root = document.documentElement.style;
  for (const step of steps) {
    const property = `--slotted-radius-${step}`;
    if (corners === "standard") root.removeProperty(property);
    else root.setProperty(property, `${String(cornerScales[corners][step])}px`);
  }
  listeners.forEach((listener) => {
    listener();
  });
}

// Every reader sees the choice at once.
export function useCorners(): [Corners, (corners: Corners) => void] {
  return [useSyncExternalStore(subscribe, snapshot), applyCorners];
}
