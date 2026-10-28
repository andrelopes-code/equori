import { useCallback, useLayoutEffect, useRef } from "react";

// A function of one identity that calls the latest handler, for a handler a memoised renderer
// or an effect reads.
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
