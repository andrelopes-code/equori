import { useSyncExternalStore } from "react";

export type Viewport = "phone" | "tablet" | "desktop";

const DESKTOP_QUERY = "(min-width: 1024px)";
const TABLET_QUERY = "(min-width: 600px)";

function subscribe(onChange: () => void): () => void {
  const lists = [matchMedia(DESKTOP_QUERY), matchMedia(TABLET_QUERY)];
  for (const list of lists) {
    list.addEventListener("change", onChange);
  }
  return () => {
    for (const list of lists) {
      list.removeEventListener("change", onChange);
    }
  };
}

function getSnapshot(): Viewport {
  if (matchMedia(DESKTOP_QUERY).matches) return "desktop";
  if (matchMedia(TABLET_QUERY).matches) return "tablet";
  return "phone";
}

export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, getSnapshot);
}
