import { describe, expect, it } from "vitest";

import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { orderText } from "@/features/portfolio/contribution-plan/month/order-text";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";

const brl = (amount: number) => ({ amount, currency: "BRL" });

const words = {
  t: ((key, vars) =>
    catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
      String(vars?.[name]),
    )) satisfies TFunction,
  money: (m: { amount: number }) =>
    `R$ ${(m.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  locale: "pt-BR",
  hidden: false,
};

describe("orderText", () => {
  it.each<[string, Partial<ShoppingEntry>, string | undefined]>([
    [
      "units times the unit price",
      { quantity: "9", unit: brl(14602) },
      "≈ 9 cotas × R$ 146,02",
    ],
    [
      "one unit in the singular",
      { quantity: "1", unit: brl(1510) },
      "≈ 1 cota × R$ 15,10",
    ],
    [
      "a quantity with decimals named by its instrument",
      { quantity: "0.00098412", symbol: "BTC", unit: brl(35000000) },
      "≈ 0,00098412 BTC × R$ 350.000,00",
    ],
    ["units without a unit price", { quantity: "4" }, "≈ 4 cotas"],
    ["an entry bought by value", { byValue: true }, "aplicação por valor"],
    [
      "an instrument without a price",
      { unpriced: true },
      "sem cotação · valor planejado",
    ],
    [
      "nothing for a group that waits for a split",
      { splitToSee: true },
      undefined,
    ],
  ])("writes %s", (_, fields, want) => {
    const entry: ShoppingEntry = {
      name: "X",
      cost: brl(100),
      group: 0,
      ...fields,
    };

    expect(orderText(entry, words)).toBe(want);
  });

  it("masks the units in privacy mode, in the plural whatever the count", () => {
    const entry: ShoppingEntry = {
      name: "BBAS3",
      cost: brl(1510),
      group: 0,
      quantity: "1",
      unit: brl(1510),
    };

    const got = orderText(entry, {
      ...words,
      hidden: true,
      money: () => "R$ ••",
    });

    expect(got).toBe(`≈ ${MASK} cotas × R$ ••`);
  });
});
