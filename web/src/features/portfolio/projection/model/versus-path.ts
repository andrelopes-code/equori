import type { components } from "@/api/schema.gen";
import { planLine } from "@/features/portfolio/projection/model/plan-line";
import { versusFigures } from "@/features/portfolio/projection/model/versus-figures";
import type { VersusFigures } from "@/features/portfolio/projection/model/versus-figures";

type Change = components["schemas"]["ProjectionChange"];
type Point = components["schemas"]["ReturnSeriesPoint"];

export interface VersusPath {
  // Every recorded month and the plan line of the same months; both start on the same value.
  points: Point[];
  line: number[];
  figures: VersusFigures;
}

// PX7, PX19: the whole recorded history against the plan line; null under two recorded months. The
// figures leave the first month out: there the line is the recorded value.
export function versusPath(
  baseline: components["schemas"]["ProjectionBaseline"],
  changes: readonly Change[],
  realBp: number,
  inflationBp: number,
  points: readonly Point[],
  withdrawalFrom: string,
): VersusPath | null {
  const baselineMonth = baseline.date.slice(0, 7);
  const line = planLine(
    points,
    baselineMonth,
    changes,
    realBp,
    inflationBp,
    withdrawalFrom,
  );
  const figures = versusFigures(
    points.slice(1),
    line.slice(1),
    points.filter((p) => {
      const month = p.date.slice(0, 7);

      return month > baselineMonth && month < withdrawalFrom;
    }),
  );

  return figures === null ? null : { points: [...points], line, figures };
}
