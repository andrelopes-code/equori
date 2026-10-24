export type AllocationBy = "type" | "currency" | "institution";

export const allocationBys: readonly AllocationBy[] = [
  "type",
  "currency",
  "institution",
];

// Every key is absent while it holds its default.
export interface PortfolioSearch {
  // YYYY-MM-DD: the valuation date; today when absent.
  date?: string;
  // The valuation currency of the allocation and the return; the base currency when absent.
  value_in?: string;
  // The grouping of the allocation; the instrument type when absent.
  by?: Exclude<AllocationBy, "type">;
  // The account of the return; the first parent of an investment account when absent.
  account?: string;
  // YYYY-MM-DD: the period of the return; the 12 months ending at the valuation date when absent.
  from?: string;
  to?: string;
}

const dayPattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function matching(value: unknown, pattern: RegExp): string | undefined {
  return typeof value === "string" && pattern.test(value) ? value : undefined;
}

export function validatePortfolioSearch(
  raw: Record<string, unknown>,
): PortfolioSearch {
  const date = matching(raw.date, dayPattern);
  const valueIn = matching(raw.value_in, /^[A-Z]{3}$/);
  const by = allocationBys.find((b) => b !== "type" && b === raw.by) as
    Exclude<AllocationBy, "type"> | undefined;
  const account = matching(raw.account, uuidPattern);
  const from = matching(raw.from, dayPattern);
  const to = matching(raw.to, dayPattern);
  return {
    ...(date === undefined ? {} : { date }),
    ...(valueIn === undefined ? {} : { value_in: valueIn }),
    ...(by === undefined ? {} : { by }),
    ...(account === undefined ? {} : { account }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
}

// A change to the address: a key set to undefined returns to its default.
export type SearchPatch = {
  [K in keyof PortfolioSearch]?: PortfolioSearch[K] | undefined;
};
