import type { Basis } from "@/features/accounts/api";

export interface AccountsSearch {
  date?: string;
  basis?: Basis;
  closed?: true;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

// The balance sheet's date, basis and closed accounts are in the address, so a link reproduces it.
export function validateAccountsSearch(
  raw: Record<string, unknown>,
): AccountsSearch {
  return {
    ...(isDate(raw.date) ? { date: raw.date } : {}),
    ...(raw.basis === "settled" ? { basis: "settled" as const } : {}),
    ...(raw.closed === true ? { closed: true as const } : {}),
  };
}
