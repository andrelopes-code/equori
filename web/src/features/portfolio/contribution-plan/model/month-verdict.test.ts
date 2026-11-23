import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { monthVerdict } from "@/features/portfolio/contribution-plan/model/month-verdict";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

const deps = {
  t: ((key, vars) =>
    catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
      String(vars?.[name]),
    )) satisfies TFunction,
  money: (m: { amount: number }) =>
    `R$ ${(m.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  list: (items: string[]) =>
    new Intl.ListFormat("pt-BR", { type: "conjunction" }).format(items),
  memberName: (ref: { account_id?: string; instrument?: string }) =>
    ref.instrument ?? ref.account_id ?? "",
};

// The demo book: a contribution of 5.000,00 goes to Renda fixa and Cripto only.
const demo: Plan = {
  status: "complete",
  total: brl(1340230),
  amount: brl(500000),
  classes: [
    {
      name: "Renda fixa",
      target_bp: 4000,
      questions: [],
      question_facts: [],
      question_limits: [],
      question_ideals: false,
      rules: [],
      matched: [],
      value: brl(0),
      amount: brl(363636),
      members: [],
    },
    {
      name: "Ações Brasil",
      target_bp: 2500,
      questions: [],
      question_facts: [],
      question_limits: [],
      question_ideals: false,
      rules: [],
      matched: [],
      value: brl(0),
      amount: brl(0),
      members: [],
    },
    {
      name: "Cripto",
      target_bp: 1500,
      questions: [],
      question_facts: [],
      question_limits: [],
      question_ideals: false,
      rules: [],
      matched: [],
      value: brl(0),
      amount: brl(136364),
      members: [],
    },
  ],
  outside: [],
  missing: [],
};

describe("monthVerdict", () => {
  it("names the entries that receive money in list order and the rest", () => {
    expect(monthVerdict(demo, deps)).toBe(
      "Aplique R$ 3.636,36 em Renda fixa e R$ 1.363,64 em Cripto. Os demais grupos não recebem neste mês.",
    );
  });

  it("names the members of a group split among assets", () => {
    const view: Plan = {
      ...demo,
      classes: [
        {
          name: "Ações Brasil",
          target_bp: 10000,
          questions: [],
          question_facts: [],
          question_limits: [],
          question_ideals: false,
          rules: [],
          matched: [],
          value: brl(0),
          amount: brl(500000),
          members: [
            {
              instrument: "BOVA11",
              target_bp: 5000,
              value: brl(0),
              amount: brl(0),
            },
            {
              instrument: "BBAS3",
              target_bp: 5000,
              value: brl(0),
              amount: brl(500000),
            },
          ],
        },
      ],
    };

    expect(monthVerdict(view, deps)).toBe("Aplique R$ 5.000,00 em BBAS3.");
  });

  it("counts the purchases from three receivers on", () => {
    const view: Plan = {
      ...demo,
      classes: demo.classes.map((c, i) => ({
        ...c,
        amount: brl([100000, 250000, 150000][i] ?? 0),
      })),
    };

    expect(monthVerdict(view, deps)).toBe(
      "Aplique R$ 5.000,00 em 3 compras, listadas abaixo.",
    );
  });

  it("writes no rest clause when every group receives money", () => {
    const view: Plan = {
      ...demo,
      classes: demo.classes.filter((c) => c.name !== "Ações Brasil"),
    };

    expect(monthVerdict(view, deps)).toBe(
      "Aplique R$ 3.636,36 em Renda fixa e R$ 1.363,64 em Cripto.",
    );
  });

  it("asks for the amount when there is none", () => {
    const view: Plan = structuredClone(demo);
    delete view.amount;

    expect(monthVerdict(view, deps)).toBe(
      "Informe o valor do aporte para ver onde aplicar.",
    );
  });

  it("names the entries without a price or a rate", () => {
    const view: Plan = {
      ...demo,
      status: "incomplete",
      missing: [
        { instrument: "BTCBRL", kind: "price" },
        { instrument: "USDBRL", kind: "rate" },
      ],
    };

    expect(monthVerdict(view, deps)).toBe(
      "BTCBRL está sem cotação; sem ela o aporte não é dividido. USDBRL está sem câmbio; sem ele o aporte não é dividido.",
    );
  });

  it("says no purchase fits an amount that reaches no group", () => {
    const view: Plan = {
      ...demo,
      classes: demo.classes.map((c) => ({ ...c, amount: brl(0) })),
    };

    expect(monthVerdict(view, deps)).toBe("Nenhuma compra para este valor");
  });
});
