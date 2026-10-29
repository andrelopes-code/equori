import { useSyncExternalStore } from "react";

import { useScheme } from "@/theme/scheme";
import { useMediaQuery } from "@/ui/use-media-query";

// "glass" is an experimental style: translucent surfaces over a moving gradient (theme/glass). Its
// theme is a stylesheet of its own, loaded the first time it is turned on, so a reader who never
// turns it on never downloads it.
export type Visual = "standard" | "glass";

const STORAGE_KEY = "equori.visual";
export const defaultVisual: Visual = "standard";

const THEME: Readonly<Record<Visual, string>> = {
  standard: "equori",
  glass: "equori-glass",
};

export function isVisual(value: unknown): value is Visual {
  return value === "standard" || value === "glass";
}

export function readVisual(): Visual {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isVisual(stored) ? stored : defaultVisual;
  } catch {
    return defaultVisual;
  }
}

const listeners = new Set<() => void>();
// Holds the choice for this page load only while storage refuses the write.
let held: Visual | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): Visual {
  return held ?? readVisual();
}

// The theme name is written once its stylesheet is in the page, so the page never shows a theme
// that has no styles yet. A choice made again while the stylesheet loads wins over this one.
async function showTheme(visual: Visual): Promise<void> {
  if (visual === "glass") {
    try {
      await import("@/theme/equori-glass.gen.css");
    } catch {
      // The stylesheet is missing: the page stays on the standard theme.
      return;
    }
  }
  if (snapshot() !== visual) return;
  document.documentElement.setAttribute("data-slotted-theme", THEME[visual]);
}

export function applyVisual(visual: Visual): void {
  try {
    localStorage.setItem(STORAGE_KEY, visual);
    held = undefined;
  } catch {
    // The style still applies to this page load when storage is unavailable.
    held = visual;
  }
  void showTheme(visual);
  listeners.forEach((listener) => {
    listener();
  });
}

// Puts the stored style on the page at start. The standard style is the page's own theme, so
// there is nothing to do for it.
export function restoreVisual(): void {
  if (snapshot() !== defaultVisual) void showTheme(snapshot());
}

// Every reader sees the choice at once, so the settings page and the gradient never disagree.
export function useVisual(): [Visual, (visual: Visual) => void] {
  return [useSyncExternalStore(subscribe, snapshot), applyVisual];
}

// The glass is made for the dark scheme, where the gradient behind it can be seen. The system
// scheme counts once it resolves to dark: without the gradient the glass shell is clear over the
// boot page's fixed ground.
export function useGlass(): boolean {
  const [visual] = useVisual();
  const [scheme] = useScheme();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  return (
    visual === "glass" &&
    (scheme === "dark" || (scheme === "system" && systemDark))
  );
}
