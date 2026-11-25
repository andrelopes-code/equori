import type { ProjectionRow } from "@/features/portfolio/projection/model/project";

// PX4: the nominal view multiplies the amounts of the month k from today by
// `(1 + inflation)^(k/12)`; the first row is k = 1.
export function toNominal(
  rows: readonly ProjectionRow[],
  inflationBp: number,
): ProjectionRow[] {
  return rows.map((row, i) => {
    const factor = (1 + inflationBp / 10000) ** ((i + 1) / 12);

    return {
      month: row.month,
      contribution: row.contribution * factor,
      withdrawal: row.withdrawal * factor,
      gain: row.gain * factor,
      value: row.value * factor,
    };
  });
}
