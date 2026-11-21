export interface Day<Row> {
  date: string;
  rows: Row[];
}

// The API returns rows by date, newest first; each run of one date is a day of the statement.
export function groupByDay<Row extends { date: string }>(
  rows: readonly Row[],
): Day<Row>[] {
  const days: Day<Row>[] = [];

  for (const row of rows) {
    const last = days.at(-1);
    if (last?.date === row.date) {
      last.rows.push(row);
      continue;
    }

    days.push({ date: row.date, rows: [row] });
  }

  return days;
}
