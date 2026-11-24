import type { components } from "@/api/schema.gen";

// The opening value plus the running sum of the flows, in minor units (PR9).
export function contributed(
  opening: number,
  points: readonly components["schemas"]["ReturnSeriesPoint"][],
): number[] {
  let total = opening;

  return points.map((p) => {
    total += p.flows;

    return total;
  });
}
