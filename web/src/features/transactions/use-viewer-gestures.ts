import { useEffect, useRef, useState } from "react";

const swipeDistance = 60;

interface Point {
  x: number;
  y: number;
}

interface Handlers {
  zoom: number;
  onStep: (direction: 1 | -1) => void;
  onZoom: (next: number) => void;
}

// Gestures of the image viewer, bound to the stage element it returns the setter of: a horizontal
// swipe steps between images while the image fits, two pointers pinch the zoom, and a wheel turn
// zooms. The listeners are native because React registers wheel as passive, and the page must not
// scroll under the zoom.
export function useViewerGestures(
  handlers: Handlers,
): (el: HTMLElement | null) => void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  const [stage, setStage] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (stage === null) return;
    const pointers = new Map<number, Point>();
    let start: Point | null = null;
    let pinch: { distance: number; zoom: number } | null = null;

    const distance = () => {
      const [a, b] = [...pointers.values()];
      return a === undefined || b === undefined
        ? 0
        : Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { zoom, onZoom } = latest.current;
      onZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
    };
    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        start = { x: event.clientX, y: event.clientY };
      } else {
        start = null;
        pinch = { distance: distance(), zoom: latest.current.zoom };
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch !== null && pinch.distance > 0) {
        latest.current.onZoom((pinch.zoom * distance()) / pinch.distance);
      }
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      const from = start;
      start = null;
      if (from === null || latest.current.zoom !== 1) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (Math.abs(dx) >= swipeDistance && Math.abs(dx) > Math.abs(dy) * 2) {
        latest.current.onStep(dx < 0 ? 1 : -1);
      }
    };
    const onCancel = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      start = null;
      pinch = null;
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onCancel);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onCancel);
    };
  }, [stage]);

  return setStage;
}
