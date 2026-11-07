import type { components } from "@/api/schema.gen";
import { totalsBy } from "@/features/portfolio/year-totals";

type Event = components["schemas"]["IncomeEvent"];
type Money = components["schemas"]["Money"];
type Result = components["schemas"]["RealizedResult"];

// RE-08: the ranking draws the first ten; the table of every payment holds the rest.
const rankedInvestments = 10;

export interface IncomeChart {
  // The one currency a chart can draw: the one most events pay in. Undefined without events.
  currency: string | undefined;
  months: { month: string; net: number }[];
  investments: { code: string; net: number }[];
  // How many investments paid, before the cut at ten.
  total: number;
}

export interface IncomeTaxRow {
  type: string;
  treatment: string | null;
  gross: Money;
  withheld: Money;
  net: Money;
}

export interface SalesTotals {
  result: Money[];
  sold: Money[];
  count: number;
  months: number;
}

// PC14: what the income of a period looks like in one currency. Amounts of another currency stay
// in the figures and the tables, never converted.
export function incomeChart(
  items: readonly Event[],
  from: string,
  to: string,
): IncomeChart {
  const currency = mainCurrency(items);
  const paid = items.filter((e) => e.gross.currency === currency);
  const byMonth = new Map(monthsBetween(from, to).map((m) => [m, 0]));
  const byCode = new Map<string, number>();

  for (const e of paid) {
    const net = e.gross.amount - e.withheld.amount;
    const month = e.date.slice(0, 7);

    byMonth.set(month, (byMonth.get(month) ?? 0) + net);
    byCode.set(e.instrument, (byCode.get(e.instrument) ?? 0) + net);
  }

  const ranked = [...byCode.entries()]
    .map(([code, net]) => ({ code, net }))
    .sort((a, b) => b.net - a.net || a.code.localeCompare(b.code));

  return {
    currency,
    months: [...byMonth.entries()].map(([month, net]) => ({ month, net })),
    investments: ranked.slice(0, rankedInvestments),
    total: ranked.length,
  };
}

// PC14: one row per type, treatment and currency: the lines a tax return asks for.
export function incomeTaxRows(items: readonly Event[]): IncomeTaxRow[] {
  const rows = new Map<string, IncomeTaxRow>();

  for (const e of items) {
    const key = [e.income_type, e.tax_treatment ?? "", e.gross.currency].join(
      "\u0000",
    );
    const net = e.gross.amount - e.withheld.amount;
    const row = rows.get(key);

    if (row === undefined) {
      rows.set(key, {
        type: e.income_type,
        treatment: e.tax_treatment,
        gross: { ...e.gross },
        withheld: { ...e.withheld },
        net: { amount: net, currency: e.gross.currency },
      });
      continue;
    }

    row.gross.amount += e.gross.amount;
    row.withheld.amount += e.withheld.amount;
    row.net.amount += net;
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      (a.treatment ?? "").localeCompare(b.treatment ?? ""),
  );
}

export function salesTotals(items: readonly Result[]): SalesTotals {
  const sum = (amount: (r: Result) => Money) =>
    totalsBy(items, () => "", amount).map((row) => ({
      amount: row.amount,
      currency: row.currency,
    }));

  return {
    result: sum((r) => r.result),
    sold: sum((r) => r.proceeds),
    count: items.length,
    months: new Set(items.map((r) => r.month)).size,
  };
}

function mainCurrency(items: readonly Event[]): string | undefined {
  const counts = new Map<string, number>();

  for (const e of items) {
    counts.set(e.gross.currency, (counts.get(e.gross.currency) ?? 0) + 1);
  }

  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0];
}

function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const last = to.slice(0, 7);

  for (;;) {
    const current = `${String(year)}-${String(month).padStart(2, "0")}`;

    if (current > last) return months;

    months.push(current);
    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}
