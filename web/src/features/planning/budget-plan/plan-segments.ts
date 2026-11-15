import type {
  PlanSegment,
  SegmentTone,
} from "@/features/planning/budget-plan/plan-allocation-bar";
import type { PlanGroup } from "@/features/planning/budget-plan/plan-groups";

const groupTones: readonly SegmentTone[] = [
  "data-1",
  "data-2",
  "data-3",
  "data-4",
  "data-5",
  "data-6",
  "data-7",
  "data-8",
];

export interface SegmentNames {
  installments: string;
  savings: string;
  rest: string;
  over: string;
}

// The segments of the allocation bar: the commitments, the groups by size and the rest or
// the excess (budget plan spec 5.1).
export function planSegments(
  installments: number,
  savings: number,
  groups: readonly PlanGroup[],
  unassigned: number | undefined,
  names: SegmentNames,
): PlanSegment[] {
  const segments: PlanSegment[] = [];
  if (installments > 0)
    segments.push({
      key: "installments",
      name: names.installments,
      amount: installments,
      tone: "commitment",
    });
  if (savings > 0)
    segments.push({
      key: "savings",
      name: names.savings,
      amount: savings,
      tone: "commitment",
    });
  [...groups]
    .filter((g) => g.draft > 0)
    .sort((a, b) => b.draft - a.draft)
    .forEach((g, i) => {
      segments.push({
        key: g.id,
        name: g.name,
        amount: g.draft,
        tone: groupTones[i % groupTones.length] ?? "data-1",
        group: g.id,
      });
    });
  if (unassigned !== undefined && unassigned > 0)
    segments.push({
      key: "rest",
      name: names.rest,
      amount: unassigned,
      tone: "rest",
    });
  if (unassigned !== undefined && unassigned < 0)
    segments.push({
      key: "over",
      name: names.over,
      amount: -unassigned,
      tone: "over",
    });
  return segments;
}
