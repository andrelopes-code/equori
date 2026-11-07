import type { components } from "@/api/schema.gen";
import { sharesBP } from "@/features/portfolio/portfolio-shares";
import type { AllocationBy } from "@/features/portfolio/portfolio-search";
import { shiftDate } from "@/i18n/format";

type Account = components["schemas"]["Account"];
type Instrument = components["schemas"]["Instrument"];
type Money = components["schemas"]["Money"];
type Position = components["schemas"]["Position"];

// A price older than this many days at the valuation date is named beside the value (PC7).
const staleDays = 7;

export interface CashBalance {
  accountID: string;
  // Absent when the balance could not be valued.
  balance?: Money;
}

// One row of the portfolio: a priced or unpriced position, or the cash of a brokerage account.
export interface Holding {
  key: string;
  kind: "position" | "cash";
  code: string;
  name: string;
  accountID: string;
  type: string;
  currency: string;
  institutionID: string;
  value: number | undefined;
  position?: Position;
  // Market value minus cost, and the same over cost; absent without a price or a shared currency.
  gain: number | undefined;
  gainBp: number | undefined;
  // Cost and market value are in different currencies, so no gain is stated.
  mixed: boolean;
  // Basis points of the valued total.
  share: number | undefined;
}

export interface HoldingGroup {
  key: string;
  value: number;
  share: number;
}

export interface HoldingsSummary {
  total: number;
  positions: number;
  cash: number;
  cost: number;
  gain: number;
  gainFraction: number | undefined;
  unpriced: number;
  mixed: number;
}

// PC4: the childless currency accounts of a brokerage tree, open at the date.
// shortcut: cash posted directly on a parent brokerage that also has children is not a row; the
// model keeps cash in a child account, so read a parent's own balance if that ever changes.
export function brokerageCashAccounts(
  accounts: readonly Account[],
  instruments: readonly Instrument[],
  date: string,
): Account[] {
  const currencies = new Set(
    instruments.filter((i) => i.type === "currency").map((i) => i.code),
  );
  const parents = new Set(accounts.map((a) => a.parent_id));
  const byID = new Map(accounts.map((a) => [a.id, a]));

  return accounts.filter((a) => {
    const root = a.parent_id === undefined ? a : byID.get(a.parent_id);
    const closed = a.closed_on !== undefined && a.closed_on <= date;

    return (
      a.class === "asset" &&
      root?.kind === "brokerage" &&
      currencies.has(a.currency) &&
      !parents.has(a.id) &&
      !closed
    );
  });
}

// PC3: every figure of the page reads these rows, so the shares of a group add up to its bar and
// the total of the list is the value of the summary.
export function buildHoldings({
  positions,
  accounts,
  instruments,
  cash,
}: {
  positions: readonly Position[];
  accounts: readonly Account[];
  instruments: readonly Instrument[];
  cash: readonly CashBalance[];
}): Holding[] {
  const accountOf = new Map(accounts.map((a) => [a.id, a]));
  const instrumentOf = new Map(instruments.map((i) => [i.code, i]));
  const institutionOf = (account: Account | undefined): string => {
    const parent =
      account?.parent_id === undefined
        ? undefined
        : accountOf.get(account.parent_id);

    return account?.institution_id ?? parent?.institution_id ?? "";
  };

  const rows = [
    ...positions.map((p) =>
      positionRow(
        p,
        instrumentOf.get(p.instrument),
        institutionOf(accountOf.get(p.account_id)),
      ),
    ),
    ...cash.flatMap((c) => {
      const account = accountOf.get(c.accountID);
      if (account === undefined || c.balance?.amount === 0) return [];

      return [cashRow(account, c.balance, institutionOf(account))];
    }),
  ].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

  return withShares(rows);
}

// The groups of a dimension, largest first; an unvalued row counts in none.
export function holdingGroups(
  holdings: readonly Holding[],
  by: AllocationBy,
): HoldingGroup[] {
  const groups = new Map<string, HoldingGroup>();

  for (const holding of holdings) {
    if (holding.value === undefined) continue;

    const key = groupKey(holding, by);
    const group = groups.get(key) ?? { key, value: 0, share: 0 };

    group.value += holding.value;
    group.share += holding.share ?? 0;
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => b.value - a.value);
}

// The rows in the order of the list: a group by its value, a row by its value inside it. A row
// that holds no value stays in its group, after the valued ones.
export function orderedByGroup(
  holdings: readonly Holding[],
  by: AllocationBy,
): Holding[] {
  const rank = new Map(holdingGroups(holdings, by).map((g, i) => [g.key, i]));
  const rankOf = (h: Holding) => rank.get(groupKey(h, by)) ?? rank.size;

  return [...holdings].sort(
    (a, b) =>
      rankOf(a) - rankOf(b) || (b.value ?? -Infinity) - (a.value ?? -Infinity),
  );
}

export function groupKey(holding: Holding, by: AllocationBy): string {
  if (by === "type") return holding.type;
  if (by === "currency") return holding.currency;

  return holding.institutionID;
}

export function holdingsSummary(holdings: readonly Holding[]): HoldingsSummary {
  const sum = (rows: readonly Holding[], amount: (h: Holding) => number) =>
    rows.reduce((total, h) => total + amount(h), 0);

  const valued = holdings.filter((h) => h.value !== undefined);
  const positions = valued.filter((h) => h.kind === "position");
  const comparable = positions.filter((h) => h.gain !== undefined);
  const cost = sum(comparable, (h) => h.position?.cost_basis.amount ?? 0);
  const gain = sum(comparable, (h) => h.gain ?? 0);

  return {
    total: sum(valued, (h) => h.value ?? 0),
    positions: sum(positions, (h) => h.value ?? 0),
    cash: sum(valued, (h) => (h.kind === "cash" ? (h.value ?? 0) : 0)),
    cost,
    gain,
    gainFraction: cost === 0 ? undefined : gain / cost,
    unpriced: holdings.length - valued.length,
    mixed: holdings.filter((h) => h.mixed).length,
  };
}

// The date of the oldest price of a value when it is older than the rule of PC7.
export function staleSince(
  prices: readonly { date: string }[] | undefined,
  date: string,
): string | undefined {
  const oldest = prices?.map((p) => p.date).sort()[0];
  if (oldest === undefined) return undefined;

  return oldest < shiftDate(date, -staleDays) ? oldest : undefined;
}

function positionRow(
  position: Position,
  instrument: Instrument | undefined,
  institutionID: string,
): Holding {
  const value = position.market_value;
  const cost = position.cost_basis;
  const mixed = value !== undefined && value.currency !== cost.currency;
  const gain =
    value === undefined || mixed ? undefined : value.amount - cost.amount;

  return {
    key: `${position.account_id}-${position.instrument}`,
    kind: "position",
    code: position.instrument,
    name: instrument?.name ?? position.instrument,
    accountID: position.account_id,
    type: instrument?.type ?? "",
    currency: instrument?.quote_currency ?? cost.currency,
    institutionID,
    value: value?.amount,
    position,
    gain,
    gainBp:
      gain === undefined || cost.amount === 0
        ? undefined
        : Math.round((gain * 10000) / cost.amount),
    mixed,
    share: undefined,
  };
}

function cashRow(
  account: Account,
  balance: Money | undefined,
  institutionID: string,
): Holding {
  return {
    key: `cash-${account.id}`,
    kind: "cash",
    code: account.currency,
    name: account.name,
    accountID: account.id,
    type: "cash",
    currency: account.currency,
    institutionID,
    value: balance?.amount,
    gain: undefined,
    gainBp: undefined,
    mixed: false,
    share: undefined,
  };
}

function withShares(rows: readonly Holding[]): Holding[] {
  const valued = rows.filter((r) => r.value !== undefined);
  const shares = sharesBP(valued.map((r) => r.value ?? 0));
  const shareOf = new Map(valued.map((r, i) => [r, shares[i]]));

  return rows.map((r) => ({ ...r, share: shareOf.get(r) }));
}
