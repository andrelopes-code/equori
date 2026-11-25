import type { components } from "@/api/schema.gen";
import { planLine } from "@/features/portfolio/projection/model/plan-line";
import { versusFigures } from "@/features/portfolio/projection/model/versus-figures";
import type { VersusFigures } from "@/features/portfolio/projection/model/versus-figures";

type Change = components["schemas"]["ProjectionChange"];
type Point = components["schemas"]["ReturnSeriesPoint"];

export interface VersusSince {
  // The history points of the months after the baseline month, and the plan line of the same months.
  since: Point[];
  line: number[];
  figures: VersusFigures;
}

// PX7: the recorded points after the baseline month against the plan line of the same months;
// null while no point follows the baseline month.
export function versusSince(
  baseline: components["schemas"]["ProjectionBaseline"],
  changes: readonly Change[],
  realBp: number,
  inflationBp: number,
  points: readonly Point[],
): VersusSince | null {
  const since = points.filter(
    (p) => p.date.slice(0, 7) > baseline.date.slice(0, 7),
  );
  const line = planLine(
    baseline,
    changes,
    realBp,
    inflationBp,
    since.map((p) => p.date.slice(0, 7)),
  );
  const figures = versusFigures(since, line);

  return figures === null ? null : { since, line, figures };
}
