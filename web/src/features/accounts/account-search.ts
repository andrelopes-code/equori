export type AccountTab =
  | "activity"
  | "reconciliation"
  | "imports"
  | "scheduled"
  | "positions"
  | "sync";

export type Range = 30 | 90 | 365;

export interface AccountSearch {
  tab?: Exclude<AccountTab, "activity">;
  range?: 30 | 365;
  from?: string;
  to?: string;
  assert?: true;
}

const tabs: readonly AccountTab[] = [
  "reconciliation",
  "imports",
  "scheduled",
  "positions",
  "sync",
];

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

// The open tab, the chart's range, the movements' period and an open assertion form live in the
// address (FM-12), so the back gesture closes the form and a link reproduces the page.
export function validateAccountSearch(
  raw: Record<string, unknown>,
): AccountSearch {
  const tab = tabs.find((t) => t === raw.tab);
  const range = raw.range === 30 || raw.range === 365 ? raw.range : undefined;
  return {
    ...(tab === undefined
      ? {}
      : { tab: tab as Exclude<AccountTab, "activity"> }),
    ...(range === undefined ? {} : { range }),
    ...(isDate(raw.from) ? { from: raw.from } : {}),
    ...(isDate(raw.to) ? { to: raw.to } : {}),
    ...(raw.assert === true ? { assert: true as const } : {}),
  };
}

// The address after a tab is chosen: the default tab is left out, and an open form closes.
export function withTab(prev: AccountSearch, tab: AccountTab): AccountSearch {
  const next: AccountSearch = { ...prev };
  delete next.tab;
  delete next.assert;
  return tab === "activity" ? next : { ...next, tab };
}

export function withRange(prev: AccountSearch, range: Range): AccountSearch {
  const next: AccountSearch = { ...prev };
  delete next.range;
  return range === 90 ? next : { ...next, range };
}
