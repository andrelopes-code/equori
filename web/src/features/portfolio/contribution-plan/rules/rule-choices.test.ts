import { describe, expect, it } from "vitest";

import {
  currencyChoices,
  guaranteeChoices,
  kindChoices,
  liquidityChoices,
  typeChoices,
} from "@/features/portfolio/contribution-plan/rules/rule-choices";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;

describe("rule choices", () => {
  it("offers every security type after any, never a currency", () => {
    const values = typeChoices(t).map((c) => c.value);

    expect(values[0]).toBe("");
    expect(values).toContain("fixed_income");
    expect(values).not.toContain("currency");
  });

  it("offers the three return kinds after any", () => {
    expect(kindChoices(t).map((c) => c.value)).toEqual([
      "",
      "rate",
      "inflation",
      "fixed",
    ]);
  });

  it("offers any, yes and no for the liquidity", () => {
    expect(liquidityChoices(t).map((c) => c.label)).toEqual([
      "Qualquer",
      "Sim",
      "Não",
    ]);
  });

  it("names the guarantee of the region", () => {
    expect(guaranteeChoices(t, "FGC").map((c) => c.label)).toEqual([
      "Qualquer",
      "Coberto pelo FGC",
      "Título público",
      "Sem garantia",
    ]);
  });

  it("lists the currencies of the catalog only", () => {
    const items = [
      { code: "BRL", type: "currency" },
      { code: "PETR4", type: "stock" },
      { code: "USD", type: "currency" },
    ];

    expect(currencyChoices(t, items).map((c) => c.value)).toEqual([
      "",
      "BRL",
      "USD",
    ]);
  });
});
