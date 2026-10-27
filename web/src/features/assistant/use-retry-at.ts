import { useEffect, useRef } from "react";

// Calls onPass once the instant retryAt passes; an instant already past calls it at once (P7).
export function useRetryAt(
  retryAt: string | undefined,
  onPass: () => void,
): void {
  const latest = useRef(onPass);
  useEffect(() => {
    latest.current = onPass;
  });
  useEffect(() => {
    if (retryAt === undefined) return;
    const timer = setTimeout(
      () => {
        latest.current();
      },
      Math.max(0, Date.parse(retryAt) - Date.now()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [retryAt]);
}
