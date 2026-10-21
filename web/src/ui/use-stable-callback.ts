import { useCallback, useLayoutEffect, useRef } from "react";

// Workaround for Slotted finding "Dialog sends focus back to its opener when onOpenChange
// changes identity": a handler written inline is a new function on each render, and in 0.1.0-beta.8
// each new one makes an open Dialog or AlertDialog give focus back to the element that opened it,
// so a field inside keeps only the first key typed. The returned function keeps one identity and
// calls the latest handler.
export function useStableCallback<Args extends unknown[]>(
  handler: (...args: Args) => void,
): (...args: Args) => void {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: Args) => {
    latest.current(...args);
  }, []);
}
