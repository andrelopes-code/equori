import { useLayoutEffect } from "react";
import type { RefObject } from "react";

const TRAVEL: KeyframeAnimationOptions = {
  duration: 380,
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
};

// The steps and the close button beside the player: they appear once the player has nearly
// reached its place, and leave before it travels back, so it never passes under them.
const ASIDE_IN: KeyframeAnimationOptions = {
  duration: 180,
  delay: 260,
  easing: "ease-out",
  fill: "backwards",
};
const ASIDE_OUT: KeyframeAnimationOptions = {
  duration: 120,
  easing: "ease-in",
  fill: "forwards",
};

// The player grows from the place of the element the reader pressed: it starts drawn over that
// element and travels to its own place. Nothing moves under reduced motion.
export function useGrow(
  panel: RefObject<HTMLElement | null>,
  origin: DOMRect | null,
  aside: readonly RefObject<HTMLElement | null>[] = [],
): void {
  useLayoutEffect(() => {
    const element = panel.current;
    if (element === null) return;

    const frames = travel(element, origin);
    if (frames === null) return;

    element.animate(frames, TRAVEL);
    for (const part of aside) void fadeAside(part.current, "in");
  }, [panel, origin, aside]);
}

// The way back: the player travels to the element it grew from, and the promise settles when
// it arrives. It settles at once when nothing moves.
export async function shrinkTo(
  element: HTMLElement | null,
  origin: DOMRect | null,
  aside: readonly (HTMLElement | null)[] = [],
): Promise<void> {
  const frames = element === null ? null : travel(element, origin);
  if (element === null || frames === null) return;

  // The last frame stays until the player leaves the page.
  const back = { ...TRAVEL, duration: 260, fill: "forwards" as const };

  // The steps leave first: the player, translucent on its way, never shows them through it.
  await Promise.all(aside.map((part) => fadeAside(part, "out")));
  await element.animate([...frames].reverse(), back).finished;
}

// The steps beside the player fade in after it grows, or out before it travels back. Nothing
// moves under reduced motion.
export async function fadeAside(
  element: HTMLElement | null,
  way: "in" | "out",
): Promise<void> {
  if (element === null || !moves(element)) return;

  const frames = [{ opacity: 0 }, { opacity: 1 }];
  const shown = way === "in" ? frames : [...frames].reverse();

  await element.animate(shown, way === "in" ? ASIDE_IN : ASIDE_OUT).finished;
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
  if (origin === null || !moves(element)) return null;

  const own = element.getBoundingClientRect();
  if (own.width === 0 || own.height === 0) return null;

  return growFrames(own, origin);
}

function moves(element: HTMLElement): boolean {
  if (typeof element.animate !== "function") return false;

  return !matchMedia("(prefers-reduced-motion: reduce)").matches;
}
