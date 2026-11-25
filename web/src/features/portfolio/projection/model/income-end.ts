import type { ProjectionRow } from "@/features/portfolio/projection/model/project";

// PX6: the first month of withdrawals whose value is zero, or null.
export function incomeEnd(rows: readonly ProjectionRow[]): string | null {
  return rows.find((r) => r.withdrawal > 0 && r.value === 0)?.month ?? null;
}
