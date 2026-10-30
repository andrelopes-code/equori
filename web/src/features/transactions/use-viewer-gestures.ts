import { useEffect, useRef } from "react";

import type { Point } from "@/features/transactions/viewer-fit";

const swipeDistance = 60;

// A wheel notch is 100 pixels of deltaY in Chromium and WebKit; a trackpad sends the same distance
// as many small events. One zoom step answers each 100 pixels, whatever their number.
const wheelNotch = 100;
const wheelStep = 0.25;
// Firefox reports a notch as 3 lines (deltaMode 1).
const lineHeight = 33;

interface Handlers {
  zoom: number;
  onStep: (direction: 1 | -1) => void;
  onZoom: (next: number, anchor: Point) => void;
}

// Gestures of the image viewer on its stage: a horizontal swipe steps between files while the
// picture fits, two pointers pinch the zoom, a wheel zooms around the pointer, a trackpad pinch
// (a wheel with ctrlKey) zooms in proportion, and a mouse drag pans a zoomed picture. The listeners
// are native because React registers wheel as passive, and the page must not scroll under the zoom.
export function useViewerGestures(
  stage: HTMLElement | null,
  handlers: Handlers,
): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (stage === null) return;

    const pointers = new Map<number, Point>();
    let start: Point | null = null;
    let pinch: { distance: number; zoom: number } | null = null;
    let wheel = 0;

    const local = (x: number, y: number): Point => {
      const rect = stage.getBoundingClientRect();
      return { x: x - rect.left, y: y - rect.top };
    };
    const span = () => {
      const [a, b] = [...pointers.values()];
      if (a === undefined || b === undefined) return null;

      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        centre: local((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { zoom, onZoom } = latest.current;
      const anchor = local(event.clientX, event.clientY);
      const delta =
        event.deltaMode === 1 ? event.deltaY * lineHeight : event.deltaY;
      if (event.ctrlKey) {
        onZoom(zoom * Math.exp(-delta / wheelNotch), anchor);
        return;
      }

      wheel += delta;
      const notches = Math.trunc(wheel / wheelNotch);
      if (notches === 0) return;

      wheel -= notches * wheelNotch;
      onZoom(zoom - notches * wheelStep, anchor);
    };
    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        start = { x: event.clientX, y: event.clientY };
        return;
      }

      start = null;
      pinch = { distance: span()?.distance ?? 0, zoom: latest.current.zoom };
    };
    const onMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (previous === undefined) return;

      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const current = span();
      if (pinch !== null && pinch.distance > 0 && current !== null) {
        latest.current.onZoom(
          (pinch.zoom * current.distance) / pinch.distance,
          current.centre,
        );
        return;
      }

      // A finger pans a zoomed picture by the stage's own scroll; a mouse needs the drag.
      if (event.pointerType === "mouse" && latest.current.zoom > 1) {
        stage.scrollLeft -= event.clientX - previous.x;
        stage.scrollTop -= event.clientY - previous.y;
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
}
