import { useCallback, useState } from "react";
import type { RefCallback } from "react";

// The block size of the element the returned ref is attached to, 0 while it is not rendered. The
// fractional size is kept: a rounded one leaves a sliver of the content between two bars that meet.
export function useExtent(): [number, RefCallback<HTMLElement>] {
  const [extent, setExtent] = useState(0);
  const ref = useCallback((element: HTMLElement | null) => {
    if (element === null) return undefined;
    const read = () => {
      setExtent(element.getBoundingClientRect().height);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => {
      observer.disconnect();
      setExtent(0);
    };
  }, []);
  return [extent, ref];
}
