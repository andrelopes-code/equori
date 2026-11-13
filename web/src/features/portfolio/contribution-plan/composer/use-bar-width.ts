import { useCallback, useState } from "react";
import type { RefCallback } from "react";

// The inline size of the element the returned ref is attached to, 0 while it is not rendered. The
// fractional size is kept: a rounded one drifts from the pointer along a wide bar.
export function useBarWidth(): [number, RefCallback<HTMLElement>] {
  const [width, setWidth] = useState(0);
  const ref = useCallback((element: HTMLElement | null) => {
    if (element === null) return undefined;
    const read = () => {
      setWidth(element.getBoundingClientRect().width);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);

    return () => {
      observer.disconnect();
      setWidth(0);
    };
  }, []);

  return [width, ref];
}
