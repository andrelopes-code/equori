import { useEffect, useRef, useState } from "react";

// The latest value, taken at most once per animation frame (P2).
export function useFrameValue<T>(value: T): T {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  const frame = useRef(0);
  useEffect(() => {
    latest.current = value;
    if (frame.current !== 0) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setShown(latest.current);
    });
  }, [value]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );
  return shown;
}
