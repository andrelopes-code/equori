import { useEffect, useRef } from "react";

// A chat state that still blocks after its retry_at passed on this client's clock is asked again
// after this delay.
const recheck = 5_000;

// Calls onPass once the instant retryAt passes; an instant already past calls it at once, and again
// after recheck each time version changes while retryAt stays the same (P7).
export function useRetryAt(
  retryAt: string | undefined,
  version: number,
  onPass: () => void,
): void {
  const latest = useRef(onPass);
  const fired = useRef<string>(undefined);
  useEffect(() => {
    latest.current = onPass;
  });
  useEffect(() => {
    if (retryAt === undefined) return;
    const left = Date.parse(retryAt) - Date.now();
    const delay = left > 0 ? left : fired.current === retryAt ? recheck : 0;
    const timer = setTimeout(() => {
      fired.current = retryAt;
      latest.current();
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [retryAt, version]);
}
