import type { components } from "@/api/schema.gen";
import type {
  CategoryClass,
  CategoryEntry,
} from "@/features/categories/category-paths";

type CategoryTotal = components["schemas"]["CategoryTotal"];

export interface GroupTotal {
  entry: CategoryEntry;
  // Minor units in the base currency, positive as the class reads: spent or earned.
  amount: number;
}

export interface Summary {
  total: number;
  groups: GroupTotal[];
}

export function previousMonth(month: string): string {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) - 1;
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthBounds(month: string): { from: string; to: string } {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

// The days a month's average divides by: those gone by in the current month, all of a past
// month, none of a month that has not begun.
export function daysCounted(month: string, today: string): number {
  const current = today.slice(0, 7);
  if (month > current) return 0;
  if (month === current) return Number(today.slice(8, 10));
  const [year = 0, mon = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}

// What a class spent or earned in the month: every top-level category counts, archived ones
// and the uncategorized holder included, so the figure does not move when the tree is filtered.
// `groups` are the top-level categories with a total, largest first, the holder left out.
export function summarize(
  entries: readonly CategoryEntry[],
  items: readonly CategoryTotal[] | undefined,
  cls: CategoryClass,
): Summary {
  const byId = new Map((items ?? []).map((item) => [item.account_id, item]));
  const own = entries.filter((e) => e.class === cls);
  const known = new Set(own.map((e) => e.id));
  const roots = own
    .filter((e) => e.parentId === undefined || !known.has(e.parentId))
    .map((entry) => ({
      entry,
      amount: byId.get(entry.id)?.subtree_total.amount ?? 0,
    }));
  return {
    total: roots.reduce((sum, r) => sum + r.amount, 0),
    groups: roots
      .filter((r) => !r.entry.uncategorized && r.amount !== 0)
      .sort(
        (a, b) =>
          b.amount - a.amount || a.entry.path.localeCompare(b.entry.path),
      ),
  };
}

export function lastMonths(month: string, count: number): string[] {
  const months = [month];
  while (months.length < count) {
    months.unshift(previousMonth(months[0] ?? month));
  }
  return months;
}

export interface TrendGroup {
  id: string;
  name: string;
  color?: number;
}

export interface Trend {
  // One record per month: `month`, the amount of each group by its id, and `pending`, what no
  // category decided yet. Amounts are minor units, positive as the class reads.
  records: Record<string, string | number>[];
  // The groups that spent in any of the months, largest overall first.
  groups: TrendGroup[];
}

// The months side by side, for the charts: each group keeps one identity across the months.
export function trendOf(
  entries: readonly CategoryEntry[],
  months: readonly {
    month: string;
    items: readonly CategoryTotal[] | undefined;
  }[],
  cls: CategoryClass,
): Trend {
  const overall = new Map<string, { entry: CategoryEntry; sum: number }>();
  const perMonth = months.map(({ month, items }) => {
    const { total, groups } = summarize(entries, items, cls);
    for (const g of groups) {
      const seen = overall.get(g.entry.id);
      overall.set(g.entry.id, {
        entry: g.entry,
        sum: (seen?.sum ?? 0) + g.amount,
      });
    }
    const grouped = groups.reduce((sum, g) => sum + g.amount, 0);
    return {
      month,
      amounts: new Map(groups.map((g) => [g.entry.id, g.amount])),
      pending: total - grouped,
    };
  });
  const groups = [...overall.values()]
    .sort((a, b) => b.sum - a.sum || a.entry.path.localeCompare(b.entry.path))
    .map(({ entry }) => ({
      id: entry.id,
      name: entry.name,
      ...(entry.color === undefined ? {} : { color: entry.color }),
    }));
  return {
    groups,
    records: perMonth.map(({ month, amounts, pending }) => ({
      month,
      ...Object.fromEntries(groups.map((g) => [g.id, amounts.get(g.id) ?? 0])),
      pending,
    })),
  };
}

// The days of the month before that a month in progress is compared with: the same days, so
// seventeen days of October are not set against all of September. A finished month, or one
// whose last day is today, is compared with the whole month before.
export function comparableBounds(
  month: string,
  today: string,
): { from: string; to: string } {
  const before = monthBounds(previousMonth(month));
  const elapsed = daysCounted(month, today);
  const length = Number(monthBounds(month).to.slice(8, 10));
  if (elapsed === 0 || elapsed >= length) return before;
  const last = Number(before.to.slice(8, 10));
  return {
    from: before.from,
    to: `${before.to.slice(0, 8)}${String(Math.min(elapsed, last)).padStart(2, "0")}`,
  };
}

// A straight line: the month ends as the days gone by suggest. Undefined before a day has
// gone by.
export function projectMonth(
  total: number,
  days: number,
  monthDays: number,
): number | undefined {
  return days === 0 ? undefined : Math.round((total * monthDays) / days);
}

// The group that grew most from the period before, with the growth. A group the period before
// did not have grew from nothing. Undefined when nothing grew or nothing came before.
export function biggestRise(
  current: Summary,
  previous: Summary | undefined,
): GroupTotal | undefined {
  if (previous === undefined || previous.total === 0) return undefined;
  const before = new Map(previous.groups.map((g) => [g.entry.id, g.amount]));
  let best: GroupTotal | undefined;
  for (const g of current.groups) {
    const growth = g.amount - (before.get(g.entry.id) ?? 0);
    if (growth > 0 && (best === undefined || growth > best.amount)) {
      best = { entry: g.entry, amount: growth };
    }
  }
  return best;
}
