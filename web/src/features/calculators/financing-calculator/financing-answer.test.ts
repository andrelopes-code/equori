import { describe, expect, it } from "vitest";

import {
  priceSchedule,
  sacSchedule,
} from "@/features/calculators/financing-calculator/annuity";
import {
  emptySentence,
  financingFacts,
  prepayChoices,
  splitBarRows,
} from "@/features/calculators/financing-calculator/financing-answer";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";
import { annualToMonthly } from "@/features/calculators/model/rate-math";

const amount = 30000000;
const rate = annualToMonthly(0.115);
const months = 360;

describe("financingFacts", () => {
  it("takes the total paid and the interest of Price and the interest saved in SAC", () => {
    const facts = financingFacts(
      priceSchedule(amount, rate, months),
      sacSchedule(amount, rate, months),
    );

    expect(facts).toEqual({
      paid: 102319789,
      interest: 72319789,
      // 72319789 - 49344212
      saved: 22975577,
    });
  });
});

describe("prepayChoices", () => {
  const input = { amount, rate, months, month: 24, extra: 2000000 };

  it("states what shortening the term and lowering the installment save", () => {
    expect(prepayChoices(input)).toEqual({
      // 65788013 - 41002454; (360 - 24) - 242
      keepInstallment: { months: 242, fewer: 94, saved: 24785559 },
      // 65788013 - 61359428
      keepTerm: { installment: 265091, saved: 4428585 },
    });
  });

  it("returns null for a month outside 1 to the term minus one", () => {
    expect(prepayChoices({ ...input, month: 0 })).toBeNull();
    expect(prepayChoices({ ...input, month: months })).toBeNull();
  });
});

describe("splitBarRows", () => {
  it("adds the interest of each system to the amount and names the values", () => {
    const rows = splitBarRows({
      amount: 30000000,
      systems: [
        { name: "Price", interest: 72319789 },
        { name: "SAC", interest: 49344212 },
      ],
      format: (minor) => `<${String(minor)}>`,
      paidLabel: "Paid",
      interestLabel: "Interest",
    });

    expect(rows).toEqual([
      {
        name: "Price",
        parts: [30000000, 72319789],
        total: "<102319789>",
        label: "Price: Paid <102319789>, Interest <72319789>",
      },
      {
        name: "SAC",
        parts: [30000000, 49344212],
        total: "<79344212>",
        label: "SAC: Paid <79344212>, Interest <49344212>",
      },
    ]);
  });
});

const tPt: TFunction = (key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  );

describe("emptySentence", () => {
  const labels = {
    amount: "Valor financiado",
    rate: "Taxa de juros",
    months: "Prazo",
    installment: "Prestação Price",
  };
  const base = {
    complete: false,
    missing: { amount: true, rate: true, months: true, installment: false },
    labels,
    what: "a prestação",
    noSolution: "sem solução",
    t: tPt,
    tag: "pt-BR",
  };

  it("names the missing inputs in reading order", () => {
    expect(emptySentence(base)).toBe(
      "Preencha valor financiado, taxa de juros e prazo para ver a prestação.",
    );
  });

  it("names the figure being solved", () => {
    expect(
      emptySentence({
        ...base,
        missing: {
          amount: false,
          rate: false,
          months: true,
          installment: true,
        },
        what: tPt("calc.financing.answer.what.rate"),
      }),
    ).toBe("Preencha prazo e prestação price para ver a taxa.");
  });

  it("states that a complete loan has no solution", () => {
    expect(emptySentence({ ...base, complete: true })).toBe("sem solução");
  });
});
