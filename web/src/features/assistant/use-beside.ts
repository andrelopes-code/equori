import { useSyncExternalStore } from "react";

const BESIDE_QUERY = "(min-width: 1200px)";

function subscribe(onChange: () => void): () => void {
  const list = matchMedia(BESIDE_QUERY);
  list.addEventListener("change", onChange);
  return () => {
    list.removeEventListener("change", onChange);
  };
}

// Whether the assistant is the shell's pane beside the page (P9).
export function useBeside(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(BESIDE_QUERY).matches,
  );
}
