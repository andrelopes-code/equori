import type { ProjectionRow } from "@/features/portfolio/projection/model/project";

// PX6, PX20: the first month with an amount due and a value of zero, or null.
export function incomeEnd(
  rows: readonly ProjectionRow[],
  due: (month: string) => number,
): string | null {
  return rows.find((r) => due(r.month) > 0 && r.value === 0)?.month ?? null;
}
