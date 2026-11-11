const segments = 20;

// Segments of 5% painted for a progress in basis points; the last one only when the goal is
// reached, so an almost complete goal never reads as complete.
export function goalSegments(basisPoints: number): number {
  if (basisPoints >= 10000) return segments;
  return Math.min(segments - 1, Math.max(0, Math.floor(basisPoints / 500)));
}
