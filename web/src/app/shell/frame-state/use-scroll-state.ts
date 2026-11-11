import { useEffect, useState } from "react";
import type { RefObject } from "react";

export interface ScrollState {
  // The content has left its resting position, so the page's own header is passing under the bar.
  scrolled: boolean;
}

const SCROLLED = 8;

export function useScrollState(
  target: RefObject<HTMLElement | null>,
): ScrollState {
  const [state, setState] = useState<ScrollState>({ scrolled: false });
  useEffect(() => {
    const element = target.current;
    if (element === null) return;
    const onScroll = () => {
      const scrolled = element.scrollTop > SCROLLED;
      setState((previous) =>
        previous.scrolled === scrolled ? previous : { scrolled },
      );
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
    };
  }, [target]);
  return state;
}
