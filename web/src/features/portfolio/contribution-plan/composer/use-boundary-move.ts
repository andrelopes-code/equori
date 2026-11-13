import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { moveBoundary } from "@/features/portfolio/contribution-plan/model/move-boundary";

const wholeBar = 10000;
const arrowBp = 100;
const shiftArrowBp = 500;

interface BoundaryMoveInput {
  index: number;
  targets: number[];
  locked: boolean[];
  disabled: boolean;
  barWidth: number;
  onTargets: (next: number[]) => void;
}

interface BoundaryMoveHandlers {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
}

interface DragStart {
  x: number;
  targets: number[];
}

// The keyboard and the pointer of one handle. A drag measures from the targets and the position
// at the pointer down, so the boundary follows the pointer however many events arrive.
export function useBoundaryMove(
  input: BoundaryMoveInput,
): BoundaryMoveHandlers {
  const { index, targets, locked, disabled, barWidth, onTargets } = input;
  const start = useRef<DragStart | null>(null);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const delta = keyDelta(event.key, event.shiftKey);
    if (disabled || delta === undefined) return;
    event.preventDefault();
    onTargets(moveBoundary(targets, locked, index, delta));
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, targets };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (start.current === null || barWidth === 0) return;
    const deltaBp = ((event.clientX - start.current.x) / barWidth) * wholeBar;
    onTargets(moveBoundary(start.current.targets, locked, index, deltaBp));
  }

  function onPointerUp() {
    start.current = null;
  }

  return { onKeyDown, onPointerDown, onPointerMove, onPointerUp };
}

// Home and End ask for more than the bar holds: the clamp of moveBoundary stops at the neighbour.
function keyDelta(key: string, shift: boolean): number | undefined {
  const step = shift ? shiftArrowBp : arrowBp;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return step;
    case "ArrowLeft":
    case "ArrowDown":
      return -step;
    case "Home":
      return -wholeBar;
    case "End":
      return wholeBar;
    default:
      return undefined;
  }
}
