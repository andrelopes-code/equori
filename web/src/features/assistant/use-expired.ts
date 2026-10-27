import { useEffect, useState } from "react";

// A delay over 2^31 - 1 ms fires at once; an instant that far needs no timer.
const maxDelay = 2 ** 31 - 1;

// Whether the instant expiresAt has passed; while active, one timer to that instant marks it (P15).
export function useExpired(expiresAt: string, active: boolean): boolean {
  const at = Date.parse(expiresAt);
  const [passed, setPassed] = useState(() =>
    Date.now() >= at ? at : Number.NaN,
  );
  useEffect(() => {
    if (!active) return;
    const left = at - Date.now();
    if (left > maxDelay) return;
    const timer = setTimeout(
      () => {
        setPassed(at);
      },
      Math.max(0, left),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [at, active]);
  return passed === at;
}
