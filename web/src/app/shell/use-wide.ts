import { useSyncExternalStore } from "react";

const WIDE_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void): () => void {
  const list = matchMedia(WIDE_QUERY);
  list.addEventListener("change", onChange);
  return () => {
    list.removeEventListener("change", onChange);
  };
}

function getSnapshot(): boolean {
  return matchMedia(WIDE_QUERY).matches;
}

// True where the desktop layout applies; below it the phone layout does.
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
