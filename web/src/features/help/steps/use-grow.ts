import { useLayoutEffect } from "react";
import type { RefObject } from "react";

const GROW: KeyframeAnimationOptions = {
  duration: 380,
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
};

// The player grows from the place of the element the reader pressed: it starts drawn over that
// element and travels to its own place. Nothing moves under reduced motion.
export function useGrow(
  panel: RefObject<HTMLElement | null>,
  origin: DOMRect | null,
): void {
  useLayoutEffect(() => {
    const element = panel.current;
    if (element === null || origin === null) return;
    // jsdom and an old browser lack the Web Animations API: the player opens in place.
    if (typeof element.animate !== "function") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const own = element.getBoundingClientRect();
    if (own.width === 0 || own.height === 0) return;

    const x = origin.left + origin.width / 2 - (own.left + own.width / 2);
    const y = origin.top + origin.height / 2 - (own.top + own.height / 2);
    const scale = origin.width / own.width;

    element.animate(
      [
        {
          transform: `translate(${String(x)}px, ${String(y)}px) scale(${String(scale)})`,
          opacity: 0.6,
        },
        { transform: "none", opacity: 1 },
      ],
      GROW,
    );
  }, [panel, origin]);
}
