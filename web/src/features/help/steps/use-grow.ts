import { useLayoutEffect } from "react";
import type { RefObject } from "react";

const TRAVEL: KeyframeAnimationOptions = {
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
    if (element === null) return;

    const frames = travel(element, origin);
    if (frames === null) return;

    element.animate(frames, TRAVEL);
  }, [panel, origin]);
}

// The way back: the player travels to the element it grew from, and the promise settles when
// it arrives. It settles at once when nothing moves.
export async function shrinkTo(
  element: HTMLElement | null,
  origin: DOMRect | null,
): Promise<void> {
  const frames = element === null ? null : travel(element, origin);
  if (element === null || frames === null) return;

  // The last frame stays until the player leaves the page.
  const back = { ...TRAVEL, duration: 260, fill: "forwards" as const };

  await element.animate([...frames].reverse(), back).finished;
}

// The frames from the place of the origin to the place of the player.
export function growFrames(own: DOMRect, origin: DOMRect): Keyframe[] {
  const x = origin.left + origin.width / 2 - (own.left + own.width / 2);
  const y = origin.top + origin.height / 2 - (own.top + own.height / 2);
  const scale = origin.width / own.width;

  return [
    {
      transform: `translate(${String(x)}px, ${String(y)}px) scale(${String(scale)})`,
      opacity: 0.6,
    },
    { transform: "none", opacity: 1 },
  ];
}

// Null when the player opens and closes in place: no origin, reduced motion, or a browser
// (and jsdom) without the Web Animations API.
function travel(
  element: HTMLElement,
  origin: DOMRect | null,
): Keyframe[] | null {
  if (origin === null) return null;
  if (typeof element.animate !== "function") return null;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

  const own = element.getBoundingClientRect();
  if (own.width === 0 || own.height === 0) return null;

  return growFrames(own, origin);
}
