import { useEffect, useState } from "react";
import type { RefObject } from "react";

export interface ScrollState {
  // The content has left its resting position, so the page's own header is passing under the bar.
  scrolled: boolean;
  // The last movement went down, past the first screenful of header.
  down: boolean;
}

const SCROLLED = 8;
const DOWN_FROM = 64;
// Movements below this are a finger settling, not a direction.
const JITTER = 4;

export function useScrollState(
  target: RefObject<HTMLElement | null>,
): ScrollState {
  const [state, setState] = useState<ScrollState>({
    scrolled: false,
    down: false,
  });
  useEffect(() => {
    const element = target.current;
    if (element === null) return;
    let last = element.scrollTop;
    const onScroll = () => {
      const top = element.scrollTop;
      const delta = top - last;
      if (Math.abs(delta) < JITTER && top > SCROLLED) return;
      last = top;
      const next = {
        scrolled: top > SCROLLED,
        down: delta > 0 && top > DOWN_FROM,
      };
      setState((previous) =>
        previous.scrolled === next.scrolled && previous.down === next.down
          ? previous
          : next,
      );
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
    };
  }, [target]);
  return state;
}
