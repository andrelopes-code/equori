import type { ViewMoney } from "@/features/assistant/view/view-types";

export interface CompareData {
  periods: [{ from: string; to: string }, { from: string; to: string }];
  items: {
    account_id: string;
    name: string;
    before: ViewMoney;
    after: ViewMoney;
  }[];
  difference: ViewMoney;
}

export interface CompareRow {
  key: string;
  name: string;
  before: ViewMoney;
  after: ViewMoney;
  // after − before, in minor units.
  delta: number;
  beforeWidth: number;
  afterWidth: number;
}

// Paired bars on one axis: both periods against the largest value of either.
export function compareRows(data: CompareData): CompareRow[] {
  const largest = Math.max(
    0,
    ...data.items.flatMap((i) => [i.before.amount, i.after.amount]),
  );
  const width = (amount: number) =>
    largest > 0 ? (Math.max(amount, 0) / largest) * 100 : 0;

  return data.items.map((i) => ({
    key: i.account_id,
    name: i.name,
    before: i.before,
    after: i.after,
    delta: i.after.amount - i.before.amount,
    beforeWidth: width(i.before.amount),
    afterWidth: width(i.after.amount),
  }));
}
