import { useEffect, useState, type RefObject } from "react";

// The desktop size class of the guidelines, read on the page region instead of the viewport.
const WIDE_EXTENT = 1024;

// Whether the region keeps the desktop width. True until the first measure, so a region that
// nothing measures follows the viewport.
export function useRegionWide(region: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const element = region.current;

    if (element === null) return undefined;

    const observer = new ResizeObserver(() => {
      setWide(element.getBoundingClientRect().width >= WIDE_EXTENT);
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [region]);

  return wide;
}
