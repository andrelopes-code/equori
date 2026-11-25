import type {
  CaseKind,
  JourneyFigures,
} from "@/features/portfolio/projection/journey-block/journey-figures";
import type { PlanCase } from "@/features/portfolio/projection/model/plan-case";

export interface CaseRowData extends PlanCase {
  kind: CaseKind | "plan";
  returnBp: number;
}

// PX16: the plan between the cautious and the favorable case, by return.
export function caseRows(
  figures: JourneyFigures,
  planBp: number,
): CaseRowData[] {
  const plan: CaseRowData = { ...figures, kind: "plan", returnBp: planBp };

  return [plan, ...figures.cases].sort((a, b) => a.returnBp - b.returnBp);
}
