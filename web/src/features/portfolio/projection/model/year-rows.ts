import { ageAt } from "@/features/portfolio/projection/model/age-at";
import type { ProjectionRow } from "@/features/portfolio/projection/model/project";

export interface YearRow {
  year: number;
  age: number;
  contributions: number;
  gains: number;
  withdrawals: number;
  contributed: number;
  value: number;
}

// PX10: per calendar year the age on 31 December, the sums of contributions, gains and
// withdrawals, the contributions summed up to the year and the last value.
export function yearRows(
  rows: readonly ProjectionRow[],
  birthDate: string,
): YearRow[] {
  const years: YearRow[] = [];
  let contributed = 0;

  for (const row of rows) {
    const year = Number(row.month.slice(0, 4));
    contributed += row.contribution;
    let current = years.at(-1);
    if (current?.year !== year) {
      current = {
        year,
        age: ageAt(birthDate, `${String(year)}-12-31`),
        contributions: 0,
        gains: 0,
        withdrawals: 0,
        contributed,
        value: row.value,
      };
      years.push(current);
    }
    current.contributions += row.contribution;
    current.gains += row.gain;
    current.withdrawals += row.withdrawal;
    current.contributed = contributed;
    current.value = row.value;
  }

  return years;
}
