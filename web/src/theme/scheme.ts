import { useSyncExternalStore } from "react";

export type Scheme = "dark" | "light" | "high-contrast" | "system";

export const schemes: readonly Scheme[] = [
  "dark",
  "light",
  "high-contrast",
  "system",
];

const STORAGE_KEY = "equori.scheme";
export const defaultScheme: Scheme = "dark";

function isScheme(value: unknown): value is Scheme {
  return (schemes as readonly unknown[]).includes(value);
}

export function readScheme(): Scheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isScheme(stored) ? stored : defaultScheme;
  } catch {
    return defaultScheme;
  }
}

const listeners = new Set<() => void>();
// Holds the choice for this page load only while storage refuses the write.
let held: Scheme | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): Scheme {
  return held ?? readScheme();
}

export function applyScheme(scheme: Scheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
    held = undefined;
  } catch {
    // The scheme still applies to this page load when storage is unavailable.
    held = scheme;
  }
  const resolved =
    scheme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : scheme;
  document.documentElement.setAttribute("data-slotted-scheme", resolved);
  paintThemeColor();
  listeners.forEach((listener) => {
    listener();
  });
}

// Android paints its status bar, and an installed app its title bar, in theme-color; the
// colour follows the scheme's surface so the bar and the page read as one plane.
function paintThemeColor(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!(meta instanceof HTMLMetaElement)) return;
  // The token is a relative colour over a seed; a probe resolves it to a colour a meta accepts.
  const probe = document.createElement("span");
  probe.style.color = "var(--slotted-surface)";
  probe.hidden = true;
  document.documentElement.append(probe);
  let color = getComputedStyle(probe).color;
  probe.remove();
  // An engine that leaves var() unresolved in a computed colour (jsdom) gets the token as written.
  if (color.includes("var(")) {
    color = getComputedStyle(document.documentElement)
      .getPropertyValue("--slotted-surface")
      .trim();
  }
  if (color !== "" && !color.includes("var(")) meta.content = color;
}

// Every reader sees the choice at once, so the menu and the settings page never disagree.
export function useScheme(): [Scheme, (scheme: Scheme) => void] {
  return [useSyncExternalStore(subscribe, snapshot), applyScheme];
}
