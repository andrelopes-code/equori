import type { components } from "@/api/schema.gen";
import {
  isAssetGroup,
  sides,
  sheetRows,
  type Order,
  type SheetRow,
} from "@/features/accounts/balance-sheet/balance-sheet";
import type {
  BalanceGroup,
  Group,
} from "@/features/accounts/balance-sheet/balance-groups";

export type { Order };
export type GroupBy = "kind" | "institution" | "none";

type Money = components["schemas"]["Money"];
type Item = BalanceGroup["items"][number];

// The key of the accounts that have no institution.
export const noInstitution = "none";
const allAccounts = "all";

export interface SheetSection {
  key: string;
  // Set for a group by type.
  group?: Group;
  // Set for a group by institution; absent for the accounts without one.
  institutionId?: string;
  total: Money;
  excluded: number;
  // What the group holds over everything held, a ratio from zero to one: the total of a group
  // by type, the assets of an institution. A debt is never in a share, so a share cannot pass
  // 100 % when the debts of another group are larger than the net worth (AL4).
  share: number | undefined;
  rows: SheetRow[];
}

export interface ArrangeInput {
  // The groups by type: the figures and the base of every other grouping.
  groups: readonly BalanceGroup[];
  by: GroupBy;
  order: Order;
  locale: string;
  base: string;
  institutions: ReadonlyMap<string, { name: string }>;
  differing: ReadonlySet<string>;
}

// The sections of the list under the chosen grouping (AL2 to AL5, AL7).
export function arrangeSheet(input: ArrangeInput): SheetSection[] {
  if (input.by === "institution") return byInstitution(input);
  if (input.by === "none") return flat(input);
  return byType(input);
}

function byType(input: ArrangeInput): SheetSection[] {
  const { assets } = sides(input.groups);
  return input.groups.map((group) => ({
    key: group.group,
    group: group.group,
    total: group.total,
    excluded: group.excluded,
    share: assets > 0 ? Math.abs(group.total.amount) / assets : undefined,
    rows: rowsOf(group.items, input),
  }));
}

function byInstitution(input: ArrangeInput): SheetSection[] {
  const { assets } = sides(input.groups);
  const buckets = new Map<string, { items: Item[]; assets: number }>();
  for (const group of input.groups) {
    for (const item of group.items) {
      const key = item.account.institution_id ?? noInstitution;
      const bucket = buckets.get(key) ?? { items: [], assets: 0 };
      bucket.items.push(item);
      if (isAssetGroup(group.group) && item.balance.currency === input.base) {
        bucket.assets += item.balance.amount;
      }
      buckets.set(key, bucket);
    }
  }
  const sections = [...buckets].map(([key, bucket]): SheetSection => {
    const { total, excluded } = totals(bucket.items, input.base);
    return {
      key,
      ...(key === noInstitution ? {} : { institutionId: key }),
      total,
      excluded,
      share:
        assets > 0 && bucket.assets > 0 ? bucket.assets / assets : undefined,
      rows: rowsOf(bucket.items, input),
    };
  });
  const collator = new Intl.Collator(input.locale, { sensitivity: "base" });
  const nameOf = (section: SheetSection) =>
    input.institutions.get(section.key)?.name ?? section.key;
  const differs = (section: SheetSection) =>
    section.rows.some((row) => input.differing.has(row.account.id));
  const byBalance = (a: SheetSection, b: SheetSection) =>
    Math.abs(b.total.amount) - Math.abs(a.total.amount) ||
    collator.compare(nameOf(a), nameOf(b));
  const rank = (a: SheetSection, b: SheetSection) => {
    if (a.key === noInstitution || b.key === noInstitution) {
      return a.key === b.key ? 0 : a.key === noInstitution ? 1 : -1;
    }
    if (input.order === "name") return collator.compare(nameOf(a), nameOf(b));
    if (input.order === "attention" && differs(a) !== differs(b)) {
      return differs(a) ? -1 : 1;
    }
    return byBalance(a, b);
  };
  return sections.sort(rank);
}

// Every account in one list, each with its own balance. A parent with a zero balance holds
// nothing of its own, so the list leaves it out and keeps its sub-accounts (AL7).
function flat(input: ArrangeInput): SheetSection[] {
  const items = input.groups.flatMap((group) => group.items);
  const parents = new Set(items.map((item) => item.account.parent_id));
  const listed = items.filter(
    (item) => !parents.has(item.account.id) || item.balance.amount !== 0,
  );
  const { total, excluded } = totals(items, input.base);
  return [
    {
      key: allAccounts,
      total,
      excluded,
      share: undefined,
      rows: sheetRows({ items: listed }, input.locale, {
        order: input.order,
        base: input.base,
        differing: input.differing,
        flat: true,
      }),
    },
  ];
}

function rowsOf(items: Item[], input: ArrangeInput): SheetRow[] {
  return sheetRows({ items }, input.locale, {
    order: input.order,
    base: input.base,
    differing: input.differing,
  });
}

function totals(
  items: Item[],
  base: string,
): { total: Money; excluded: number } {
  let amount = 0;
  let excluded = 0;
  for (const item of items) {
    if (item.balance.currency === base) amount += item.balance.amount;
    else excluded += 1;
  }
  return { total: { amount, currency: base }, excluded };
}
