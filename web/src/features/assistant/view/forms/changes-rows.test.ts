import { describe, expect, it } from "vitest";

import { changesRows } from "@/features/assistant/view/forms/changes-rows";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("changesRows", () => {
  it("draws rises and falls on one scale", () => {
    const rows = changesRows({
      periods: [
        { from: "2026-09-01", to: "2026-09-30" },
        { from: "2026-10-01", to: "2026-10-31" },
      ],
      items: [
        { account_id: "a", name: "Mercado", delta: brl(31240) },
        { account_id: "b", name: "Lazer", delta: brl(-21800) },
      ],
      difference: brl(9440),
    });

    expect(rows[0]).toMatchObject({ width: 100, rise: true });
    expect(rows[1]).toMatchObject({
      width: (21800 / 31240) * 100,
      rise: false,
    });
  });
});
