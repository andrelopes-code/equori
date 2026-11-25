// PX7: the first day on which a history point falls after the baseline month, `YYYY-MM-DD`.
export function comparisonStart(baselineDate: string): string {
  const [year = 0, month = 0] = baselineDate.split("-").map(Number);

  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}
