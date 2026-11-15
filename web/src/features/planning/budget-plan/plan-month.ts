// The month before month, both written YYYY-MM.
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const year = (y ?? 0) - (m === 1 ? 1 : 0);
  const mo = m === 1 ? 12 : (m ?? 1) - 1;
  return `${String(year)}-${String(mo).padStart(2, "0")}`;
}

// The earliest later version among the rows whose draft differs from the saved amount.
export function firstNextChange(
  rows: readonly {
    draft: number;
    planned: { amount: number };
    next_change?: string;
  }[],
): string | undefined {
  return rows
    .filter((r) => r.draft !== r.planned.amount && r.next_change !== undefined)
    .map((r) => r.next_change ?? "")
    .sort()[0];
}
