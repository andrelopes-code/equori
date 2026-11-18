import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { frameAt, restingAt } from "@/features/help/video/compose-frame";
import type { VideoTimeline } from "@/features/help/video/compose-frame";
import { drawFrame } from "@/features/help/video/draw-frame";

interface VideoSource extends VideoTimeline {
  stills: readonly string[];
  accent: string;
}

// The stills of the video, fetched and decoded when the player opens; null until every one is.
// Until then the poster stands in.
export function useStills(urls: readonly string[]): HTMLImageElement[] | null {
  const [stills, setStills] = useState<HTMLImageElement[] | null>(null);

  useEffect(() => {
    let live = true;

    void decodedInOrder(urls).then(
      (images) => {
        if (live) setStills(images);
      },
      // A still that fails to load leaves the poster: the steps beside it are the same content.
      () => undefined,
    );

    return () => {
      live = false;
    };
  }, [urls]);

  return stills;
}

// The frame of the second `time` drawn on the canvas. Under reduced motion every frame is the
// resting frame of its part.
export function useDrawFrame(
  canvas: RefObject<HTMLCanvasElement | null>,
  stills: readonly HTMLImageElement[] | null,
  video: VideoSource,
  time: number,
  reduced: boolean,
): void {
  const drawn = useRef<string | null>(null);

  useEffect(() => {
    const context = stills === null ? null : canvas.current?.getContext("2d");
    if (stills === null || context === null || context === undefined) return;

    const frame = frameAt(video, reduced ? restingAt(video, time) : time);
    // A frame equal to the one drawn (the pointer at rest on a step) is not drawn again.
    const key = JSON.stringify(frame);
    if (key === drawn.current) return;

    drawn.current = key;
    drawFrame(context, stills, frame, {
      accent: video.accent,
      font: fontOf(canvas.current),
    });
  }, [canvas, stills, video, time, reduced]);
}

// The first still before the others: it is the poster, and the request for it goes alone.
async function decodedInOrder(
  urls: readonly string[],
): Promise<HTMLImageElement[]> {
  const [first, ...rest] = urls;
  if (first === undefined) return [];

  const poster = await decoded(first);

  return [poster, ...(await Promise.all(rest.map(decoded)))];
}

async function decoded(url: string): Promise<HTMLImageElement> {
  const image = new Image();

  image.src = url;
  await image.decode();

  return image;
}

// The font of the application, already loaded by the page, for the number of the mark.
function fontOf(element: HTMLElement | null): string {
  if (element === null) return "sans-serif";

  return (
    getComputedStyle(element).getPropertyValue("--slotted-font-family-sans") ||
    "sans-serif"
  );
}
