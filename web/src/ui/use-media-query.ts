import { useCallback, useSyncExternalStore } from "react";

// Size classes of the guidelines: 600 px splits phone from tablet, 1024 px tablet from desktop.
export const compactQuery = "(max-width: 599px)";
export const wideQuery = "(min-width: 1024px)";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}
