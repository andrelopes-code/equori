import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Point, Size } from "@/features/transactions/viewer-fit";
import { anchoredScroll, fittedSize } from "@/features/transactions/viewer-fit";

export const minZoom = 1;
export const maxZoom = 4;
export const zoomStep = 0.25;

interface Change {
  from: number;
  anchor: Point | null;
}

// The zoom of the image viewer and the size its picture is drawn at. The stage keeps its own size
// whatever the zoom: the picture grows inside it and the stage scrolls, holding the point under the
// pointer (or the stage's centre) where it was.
export function useViewerZoom(stage: HTMLElement | null) {
  const [zoom, setZoom] = useState(minZoom);
  const [natural, setNatural] = useState<Size | null>(null);
  const [box, setBox] = useState<Size | null>(null);
  const pending = useRef<Change | null>(null);

  useEffect(() => {
    if (stage === null) return;

    const measure = () => {
      setBox({ width: stage.clientWidth, height: stage.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);

    return () => {
      observer.disconnect();
    };
  }, [stage]);

  useLayoutEffect(() => {
    const change = pending.current;
    pending.current = null;
    if (stage === null || change === null) return;

    const anchor = change.anchor ?? {
      x: stage.clientWidth / 2,
      y: stage.clientHeight / 2,
    };
    const next = anchoredScroll(
      { x: stage.scrollLeft, y: stage.scrollTop },
      anchor,
      zoom / change.from,
    );
    scrollStage(stage, next);
  }, [stage, zoom]);

  const zoomTo = (next: number, anchor: Point | null = null) => {
    const clamped = Math.min(maxZoom, Math.max(minZoom, next));
    if (clamped === zoom) return;

    pending.current ??= { from: zoom, anchor };
    setZoom(clamped);
  };

  // A new file starts fitted, and its own pixels are measured once it loads.
  const reset = () => {
    pending.current = null;
    setZoom(minZoom);
    setNatural(null);
  };

  const onLoad = (image: HTMLImageElement) => {
    setNatural({ width: image.naturalWidth, height: image.naturalHeight });
  };

  return {
    zoom,
    size: fittedSize(natural, box, zoom),
    zoomTo,
    fit: () => {
      zoomTo(minZoom);
    },
    reset,
    onLoad,
  };
}

function scrollStage(stage: HTMLElement, to: Point) {
  stage.scrollLeft = to.x;
  stage.scrollTop = to.y;
}
