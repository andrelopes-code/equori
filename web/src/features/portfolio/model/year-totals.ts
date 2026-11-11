export interface TotalRow {
  key: string;
  currency: string;
  amount: number;
}

// One row per group and currency: amounts of different currencies are never added.
// Rows follow the order of `keys`; the group "" (no class) comes last.
export function totalsBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  money: (item: T) => { amount: number; currency: string },
): TotalRow[] {
  const rows = new Map<string, TotalRow>();
  for (const item of items) {
    const { amount, currency } = money(item);
    const key = keyOf(item);
    const id = `${key}\u0000${currency}`;
    const row = rows.get(id);
    if (row === undefined) rows.set(id, { key, currency, amount });
    else row.amount += amount;
  }
  return [...rows.values()].sort(
    (a, b) =>
      Number(a.key === "") - Number(b.key === "") ||
      a.key.localeCompare(b.key) ||
      a.currency.localeCompare(b.currency),
  );
}
