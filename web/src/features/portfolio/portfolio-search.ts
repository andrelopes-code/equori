export interface PortfolioSearch {
  // YYYY-MM-DD: the valuation date; today when absent.
  date?: string;
}

export function validatePortfolioSearch(
  raw: Record<string, unknown>,
): PortfolioSearch {
  const date =
    typeof raw.date === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(raw.date)
      ? raw.date
      : undefined;
  return date === undefined ? {} : { date };
}
