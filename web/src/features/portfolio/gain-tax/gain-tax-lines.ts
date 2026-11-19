import type { components } from "@/api/schema.gen";

type GainTaxMonth = components["schemas"]["GainTaxMonth"];
type GainTaxLine = components["schemas"]["GainTaxLine"];

export interface GainTaxRow extends GainTaxLine {
  key: string;
  month: string;
}

// One row per pool of each month, in the order of the response: oldest month first.
export function gainTaxLines(months: readonly GainTaxMonth[]): GainTaxRow[] {
  return months.flatMap((m) =>
    m.lines.map((l) => ({ ...l, key: `${m.month}-${l.pool}`, month: m.month })),
  );
}
