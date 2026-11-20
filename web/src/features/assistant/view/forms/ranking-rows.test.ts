import { describe, expect, it } from "vitest";

import { rankingRows } from "@/features/assistant/view/forms/ranking-rows";
import type { RankingData } from "@/features/assistant/view/forms/ranking-rows";

const brl = (amount: number) => ({ amount, currency: "BRL" });

const data: RankingData = {
  total: brl(819105),
  items: [
    {
      account_id: "a",
      name: "Moradia",
      amount: brl(320000),
      share_bp: 3907,
      rank: 1,
    },
    {
      account_id: "b",
      name: "Mercado",
      amount: brl(149700),
      share_bp: 1828,
      rank: 2,
    },
    { account_id: "c", name: "Doações", amount: brl(0), share_bp: 0, rank: 3 },
  ],
  rest: { count: 7, amount: brl(192760), share_bp: 2353 },
};

describe("rankingRows", () => {
  it("draws widths against the first item", () => {
    const rows = rankingRows(data);

    expect(rows.map((r) => r.width)).toEqual([100, 46.78125, 0, 60.2375]);
  });

  it("puts the rest last, without a rank", () => {
    const rest = rankingRows(data).at(-1);

    expect(rest?.rest).toBe(true);
    expect(rest?.rank).toBeUndefined();
    expect(rest?.count).toBe(7);
  });

  it("draws nothing for an empty ranking", () => {
    expect(rankingRows({ total: brl(0), items: [] })).toEqual([]);
  });
});
