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
  paintThemeColor();
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

export function useScheme(): [Scheme, (scheme: Scheme) => void] {
  const [scheme, setScheme] = useState<Scheme>(readScheme);
  const update = useCallback((next: Scheme) => {
    applyScheme(next);
    setScheme(next);
  }, []);
  return [scheme, update];
}
