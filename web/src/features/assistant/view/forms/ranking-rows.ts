import type { ViewMoney } from "@/features/assistant/view/view-types";

export interface RankingData {
  total: ViewMoney;
  items: {
    account_id: string;
    name: string;
    amount: ViewMoney;
    share_bp: number;
    rank: number;
  }[];
  rest?: { count: number; amount: ViewMoney; share_bp: number };
}

export interface RankingRow {
  key: string;
  name: string;
  rank?: number;
  // The categories folded into the rest row.
  count?: number;
  amount: ViewMoney;
  shareBp: number;
  // Percent of the track, against the first item.
  width: number;
  rest: boolean;
}

// The rows of a ranking: each bar against the largest one, the rest last in the neutral tone.
export function rankingRows(data: RankingData): RankingRow[] {
  const largest = data.items[0]?.amount.amount ?? 0;
  const width = (amount: number) =>
    largest > 0 ? (amount / largest) * 100 : 0;

  const rows: RankingRow[] = data.items.map((it) => ({
    key: it.account_id,
    name: it.name,
    rank: it.rank,
    amount: it.amount,
    shareBp: it.share_bp,
    width: width(it.amount.amount),
    rest: false,
  }));

  if (data.rest !== undefined) {
    rows.push({
      key: "rest",
      name: "",
      count: data.rest.count,
      amount: data.rest.amount,
      shareBp: data.rest.share_bp,
      width: Math.min(width(data.rest.amount.amount), 100),
      rest: true,
    });
  }

  return rows;
}
