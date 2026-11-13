import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { segmentLabel } from "@/features/portfolio/contribution-plan/model/segment-label";
import type { SegmentLabel } from "@/features/portfolio/contribution-plan/model/segment-label";

interface SegmentLabelRefs {
  label: SegmentLabel;
  // The room inside the segment, and the two texts measured off screen.
  room: RefObject<HTMLSpanElement | null>;
  full: RefObject<HTMLSpanElement | null>;
  short: RefObject<HTMLSpanElement | null>;
}

// Picks what a segment writes inside itself. The measurement runs before paint when the key
// changes: the key names what the fit depends on (the width of the bar, the share, the texts), so
// a resize or a drag never shows a text that overflows.
export function useSegmentLabel(measureKey: string): SegmentLabelRefs {
  const room = useRef<HTMLSpanElement>(null);
  const full = useRef<HTMLSpanElement>(null);
  const short = useRef<HTMLSpanElement>(null);
  const [label, setLabel] = useState<SegmentLabel>("none");

  useLayoutEffect(() => {
    if (room.current === null || full.current === null) return;
    const fullWidth = full.current.getBoundingClientRect().width;
    const shortWidth =
      short.current?.getBoundingClientRect().width ?? fullWidth;
    setLabel(
      segmentLabel(
        room.current.getBoundingClientRect().width,
        fullWidth,
        shortWidth,
      ),
    );
  }, [measureKey]);

  return { label, room, full, short };
}
