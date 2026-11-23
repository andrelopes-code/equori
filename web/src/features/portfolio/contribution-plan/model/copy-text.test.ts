import { describe, expect, it } from "vitest";

import { copyText } from "@/features/portfolio/contribution-plan/model/copy-text";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;
const context = {
  t,
  locale: "pt-BR",
  money: (m: { amount: number }) => `R$ ${String(m.amount)}`,
};
const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("copyText", () => {
  it("writes the quantity, the cost and the leftover, one line each", () => {
    const text = copyText(
      [
        { name: "WEGE3", cost: brl(900), quantity: "12", group: 0 },
        { name: "CDB", cost: brl(80), byValue: true, group: 1 },
      ],
      brl(20),
      context,
    );

    expect(text).toBe("WEGE3  ≈ 12 cotas · R$ 900\nCDB  R$ 80\nSobra R$ 20");
  });

  it("writes no leftover line without one", () => {
    expect(
      copyText(
        [{ name: "CDB", cost: brl(80), byValue: true, group: 1 }],
        undefined,
        context,
      ),
    ).toBe("CDB  R$ 80");
  });
});
