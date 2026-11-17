import { useEffect, useState, type RefObject } from "react";

import { asideLimit } from "@/app/shell/frame-state/aside-limit";

// The largest share of the shell the pane beside the page may take (asideLimit), measured on the
// page region and the pane next to it.
export function useAsideLimit(
  region: RefObject<HTMLElement | null>,
  min: number,
  max: number,
): number {
  const [limit, setLimit] = useState(max);

  useEffect(() => {
    const element = region.current;
    const shell = element?.parentElement;

    if (element == null || shell == null) return undefined;

    const observer = new ResizeObserver(() => {
      const pane = shell.querySelector(":scope > aside");
      const room =
        element.getBoundingClientRect().width +
        (pane?.getBoundingClientRect().width ?? 0);

      setLimit(asideLimit(shell.getBoundingClientRect().width, room, min, max));
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [region, min, max]);

  return limit;
}
