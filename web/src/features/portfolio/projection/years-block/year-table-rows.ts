import type { components } from "@/api/schema.gen";
import type { ProjectionRow } from "@/features/portfolio/projection/model/project";
import { yearRows } from "@/features/portfolio/projection/model/year-rows";
import type { YearRow } from "@/features/portfolio/projection/model/year-rows";
import { contributed } from "@/features/portfolio/results/model/wealth";

// PX10: the rows of the table. `yearRows` sums the projected contributions only, so the money
// contributed so far starts from the recorded total of the history.
export function yearTableRows(
  projection: readonly ProjectionRow[],
  birthDate: string,
  history: components["schemas"]["ReturnSeries"],
): YearRow[] {
  const recorded =
    contributed(history.opening, history.points).at(-1) ?? history.opening;

  return yearRows(projection, birthDate).map((row) => ({
    ...row,
    contributed: row.contributed + recorded,
  }));
}
