import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";

import {
  clampPlace,
  readPlace,
  writePlace,
} from "@/app/shell/calculator/window-place";
import type { Place } from "@/app/shell/calculator/window-place";

export interface WindowDrag {
  // Absent until the window is moved: the stylesheet holds the first place (K7).
  place: Place | null;
  dragging: boolean;
  handlePointerDown: (event: PointerEvent<HTMLElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLElement>) => void;
  handlePointerUp: (event: PointerEvent<HTMLElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

// K8: one press of an arrow key, and with Shift.
const STEP = 16;
const LONG_STEP = 64;

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// The place of the window: moved by the pointer on its bar and by the arrow keys on its grip,
// held inside the visible area (K9) and kept per browser (K5). The stylesheet holds a place
// inside the area too, so a stored place and a smaller browser window need no code here.
export function useWindowDrag(
  frame: RefObject<HTMLElement | null>,
): WindowDrag {
  const [place, setPlace] = useState<Place | null>(readPlace);
  // The pointer's distance from the window's corner while a drag runs.
  const grab = useRef<Place | null>(null);
  const [dragging, setDragging] = useState(false);

  function inside(next: Place): Place {
    const box = frame.current?.getBoundingClientRect();
    const page = document.documentElement;

    return clampPlace(
      next,
      { width: box?.width ?? 0, height: box?.height ?? 0 },
      { width: page.clientWidth, height: page.clientHeight },
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    const box = frame.current?.getBoundingClientRect();
    const onControl =
      event.target instanceof Element &&
      event.target.closest("button:not([data-grip])") !== null;
    if (box === undefined || event.button !== 0 || onControl) return;

    grab.current = { x: event.clientX - box.left, y: event.clientY - box.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (grab.current === null) return;

    setPlace(
      inside({
        x: event.clientX - grab.current.x,
        y: event.clientY - grab.current.y,
      }),
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (grab.current === null) return;

    grab.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);

    if (place !== null) writePlace(place);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const direction = ARROWS[event.key];
    const box = frame.current?.getBoundingClientRect();
    if (direction === undefined || box === undefined) return;

    event.preventDefault();

    const step = event.shiftKey ? LONG_STEP : STEP;
    // Before the first move the stylesheet holds the place, so the box is read.
    const from = place ?? { x: box.left, y: box.top };
    const next = inside({
      x: from.x + direction[0] * step,
      y: from.y + direction[1] * step,
    });

    setPlace(next);
    writePlace(next);
  }

  return {
    place,
    dragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  };
}
