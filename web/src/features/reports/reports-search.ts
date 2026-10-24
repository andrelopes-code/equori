export type ReportsTab = "net-worth" | "categories" | "flows";

export const reportsTabs: readonly ReportsTab[] = [
  "net-worth",
  "categories",
  "flows",
];

export type NetWorthMonths = 6 | 12 | 24;

export const netWorthSpans: readonly NetWorthMonths[] = [6, 12, 24];

// Every key is absent while it holds its default.
export interface ReportsSearch {
  // The net worth tab when absent.
  tab?: Exclude<ReportsTab, "net-worth"> | undefined;
  // The months of the net worth series; 12 when absent.
  months?: Exclude<NetWorthMonths, 12> | undefined;
  // The valuation currency; the base currency when absent.
  value_in?: string | undefined;
}

// A change to the address: a key set to undefined returns to its default.
export type ReportsPatch = {
  [K in keyof ReportsSearch]?: ReportsSearch[K] | undefined;
};

export function validateReportsSearch(
  raw: Record<string, unknown>,
): ReportsSearch {
  const tab = reportsTabs.find((t) => t !== "net-worth" && t === raw.tab) as
    Exclude<ReportsTab, "net-worth"> | undefined;
  const months = [6, 24].find((n) => n === Number(raw.months)) as
    Exclude<NetWorthMonths, 12> | undefined;
  const valueIn =
    typeof raw.value_in === "string" && /^[A-Z]{3}$/.test(raw.value_in)
      ? raw.value_in
      : undefined;
  // Returned as undefined, not omitted: the router keeps raw keys the validator leaves out.
  return { tab, months, value_in: valueIn };
}
