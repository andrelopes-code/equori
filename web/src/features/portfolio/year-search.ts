export type YearTab = "realized" | "income";

// Every key is absent while it holds its default.
export interface YearSearch {
  // The year in which the tax year starts; the year of the app clock when absent.
  year?: number | undefined;
  // The panel; the realized results when absent.
  tab?: Exclude<YearTab, "realized"> | undefined;
}

// The contract accepts 1900 to 2200 (api/openapi.yaml, parameter Year).
export const minYear = 1900;
export const maxYear = 2200;

export function validateYearSearch(raw: Record<string, unknown>): YearSearch {
  const year = Number(raw.year);
  const valid =
    raw.year !== undefined &&
    raw.year !== "" &&
    Number.isInteger(year) &&
    year >= minYear &&
    year <= maxYear;
  // The keys are always present: the parent route passes the raw address on, and an absent key
  // would let an invalid year through.
  return {
    year: valid ? year : undefined,
    tab: raw.tab === "income" ? "income" : undefined,
  };
}
