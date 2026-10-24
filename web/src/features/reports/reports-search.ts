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
  // YYYY-MM-DD, both or neither: the period of the categories and flows tabs; the current month when absent.
  from?: string | undefined;
  to?: string | undefined;
  // The class of the categories tab; expense when absent.
  class?: "income" | undefined;
  // The category whose children the categories tab lists; the top level when absent.
  parent?: string | undefined;
  // The account of the flows tab; the first open account when absent.
  account?: string | undefined;
  // The granularity of the flows tab; day when absent.
  by?: "month" | undefined;
  // The period before is read beside the period.
  compare?: true | undefined;
}

// A change to the address: a key set to undefined returns to its default.
export type ReportsPatch = ReportsSearch;

const dayPattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function matching(value: unknown, pattern: RegExp): string | undefined {
  return typeof value === "string" && pattern.test(value) ? value : undefined;
}

export function validateReportsSearch(
  raw: Record<string, unknown>,
): ReportsSearch {
  const tab = reportsTabs.find((t) => t !== "net-worth" && t === raw.tab) as
    Exclude<ReportsTab, "net-worth"> | undefined;
  const months = [6, 24].find((n) => n === Number(raw.months)) as
    Exclude<NetWorthMonths, 12> | undefined;
  const from = matching(raw.from, dayPattern);
  const to = matching(raw.to, dayPattern);
  const period = from !== undefined && to !== undefined;
  // Returned as undefined, not omitted: the router keeps raw keys the validator leaves out.
  return {
    tab,
    months,
    value_in: matching(raw.value_in, /^[A-Z]{3}$/),
    from: period ? from : undefined,
    to: period ? to : undefined,
    class: raw.class === "income" ? "income" : undefined,
    parent: matching(raw.parent, uuidPattern),
    account: matching(raw.account, uuidPattern),
    by: raw.by === "month" ? "month" : undefined,
    compare: raw.compare === true || raw.compare === "true" ? true : undefined,
  };
}
