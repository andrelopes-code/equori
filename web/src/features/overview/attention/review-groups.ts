import type { ReviewSegment } from "@/features/overview/attention/attention";

export interface ReviewGroup {
  // The sources of the group; more than one only in the last group, which gathers the rest.
  segments: ReviewSegment[];
  count: number;
}

// The bar and the legend draw this many groups at most: the widest sources, then one group of the
// rest, so the legend stays on one line.
const shown = 3;

// Segments come widest first.
export function reviewGroups(
  segments: readonly ReviewSegment[],
): ReviewGroup[] {
  const head = segments.slice(
    0,
    segments.length > shown + 1 ? shown : shown + 1,
  );
  const rest = segments.slice(head.length);
  const groups = head.map((segment) => ({
    segments: [segment],
    count: segment.count,
  }));

  return rest.length === 0
    ? groups
    : [
        ...groups,
        { segments: rest, count: rest.reduce((n, s) => n + s.count, 0) },
      ];
}
