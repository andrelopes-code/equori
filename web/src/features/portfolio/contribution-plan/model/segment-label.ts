export type SegmentLabel = "full" | "percent" | "none";

// What a segment of the bar writes inside itself: the name and the percent, the percent alone, or
// nothing. The widths are in px: the room inside the segment and the measured text.
export function segmentLabel(
  width: number,
  fullWidth: number,
  percentWidth: number,
): SegmentLabel {
  if (fullWidth <= width) return "full";
  if (percentWidth <= width) return "percent";

  return "none";
}
