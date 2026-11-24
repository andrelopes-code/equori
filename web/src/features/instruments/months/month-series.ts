import type { YearChanges } from "@/features/instruments/months/month-changes";
import type { MonthReturn } from "@/ui/month-heat/month-figures";

// The months with a change, as fractions.
export function monthSeries(rows: readonly YearChanges[]): MonthReturn[] {
  return rows.flatMap(({ year, cells }) =>
    cells.flatMap((bp, month) =>
      bp === null
        ? []
        : {
            month: `${String(year)}-${String(month + 1).padStart(2, "0")}`,
            value: bp / 10000,
          },
    ),
  );
}
