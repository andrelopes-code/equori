import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  criteriaGroups,
  groupStateText,
} from "@/features/portfolio/contribution-plan/criteria/entry/group-state";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;
const brl = { amount: 0, currency: "BRL" };
const group: Group = {
  name: "Ações",
  target_bp: 5000,
  value: brl,
  questions: [],
  question_facts: [],
  question_limits: [],
  question_ideals: false,
  rules: [],
  matched: [],
  members: [{ instrument: "WEGE3", value: brl }],
};

describe("criteriaGroups", () => {
  it("offers a group that holds an instrument as a chosen asset", () => {
    const accounts = { ...group, members: [{ account_id: "a", value: brl }] };
    const byRule = { ...group, rules: [{ instrument_type: "stock" }] };

    expect(
      criteriaGroups([accounts, group, byRule]).map(({ index }) => index),
    ).toEqual([1]);
  });
});

describe("groupStateText", () => {
  it("states how the ideals are set", () => {
    expect(groupStateText(t, group)).toBe("um ideal para o grupo inteiro");
    expect(
      groupStateText(t, {
        ...group,
        members: [{ instrument: "WEGE3", value: brl, target_bp: 10000 }],
      }),
    ).toBe("ideal digitado por ativo");
  });

  it("counts the criteria and the automatic ones", () => {
    expect(
      groupStateText(t, {
        ...group,
        questions: ["P/L"],
        question_facts: ["price_earnings_max"],
      }),
    ).toBe("1 critério, 1 automático");
    expect(
      groupStateText(t, {
        ...group,
        questions: ["P/L", "Entendo?"],
        question_facts: ["price_earnings_max", ""],
      }),
    ).toBe("2 critérios, 1 automáticos");
  });
});
