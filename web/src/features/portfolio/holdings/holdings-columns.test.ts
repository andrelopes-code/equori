import { describe, expect, it } from "vitest";

import {
  holdingsColumns,
  type GridHolding,
} from "@/features/portfolio/holdings/holdings-columns";
import type { MoneyFormat } from "@/privacy/use-money-format";

describe("holdingsColumns", () => {
  it.each([
    ["fixed_income", ""],
    ["stock", "drawn"],
  ])("draws the unit columns of a %s as %j", (type, expected) => {
    const columns = holdingsColumns({
      t: (key) => key,
      fmt: fmt(),
      tag: "pt-BR",
      scale: () => 2,
      valueIn: "BRL",
      showNet: false,
    });

    const cells = ["quantity", "averageCost", "price"].map((id) =>
      columns.find((c) => c.id === id)?.format?.(null, holding(type)),
    );

    expect(cells).toEqual([expected, expected, expected]);
  });
});

function fmt(): MoneyFormat {
  const drawn = () => "drawn";

  return { money: drawn, number: drawn } as unknown as MoneyFormat;
}

// FC13: a fixed income title holds units valued at 1.00 at issue, so its quantity repeats its cost.
function holding(type: string): GridHolding {
  return {
    code: "CDB",
    type,
    position: {
      quantity: { amount: 150000000, currency: "CDB" },
      average_cost: "1",
      cost_basis: { amount: 150000, currency: "BRL" },
      prices: [
        {
          instrument: "CDB",
          value: "1.01",
          quote_instrument: "BRL",
          date: "2026-11-20",
        },
      ],
    },
  } as unknown as GridHolding;
}
