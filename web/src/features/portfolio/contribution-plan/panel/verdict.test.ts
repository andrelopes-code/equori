import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import type { CriterionView } from "@/features/portfolio/contribution-plan/panel/criterion-view";
import {
  assetVerdict,
  groupVerdict,
} from "@/features/portfolio/contribution-plan/panel/verdict";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];
type Member = Group["members"][number];

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;
const brl = (amount: number) => ({ amount, currency: "BRL" });
const own: CriterionView = {
  position: 0,
  question: "Medo?",
  text: "Medo?",
  fact: "",
  limit: "",
  effect: "hold",
  review: 0,
  counts: true,
};
const group = (over: Partial<Group> = {}): Group => ({
  name: "Cripto",
  target_bp: 10000,
  value: brl(0),
  questions: ["Medo?"],
  question_facts: [""],
  question_limits: [""],
  question_effects: ["hold"],
  question_reviews: [0],
  question_ideals: false,
  held: false,
  rules: [],
  matched: [],
  members: [],
  ...over,
});

function verdict(
  member: Partial<Member>,
  over: {
    criteria?: CriterionView[];
    forgone?: ReturnType<typeof brl>;
    holdsIgnored?: boolean;
    cls?: Group;
  } = {},
) {
  return assetVerdict({
    t,
    locale: "pt-BR",
    money: (m) => `R$ ${String(m.amount)}`,
    cls: over.cls ?? group(),
    member: { instrument: "ABTC11", value: brl(0), ...member },
    criteria: over.criteria ?? [own],
    forgone: over.forgone,
    holdsIgnored: over.holdsIgnored ?? false,
  });
}

describe("assetVerdict", () => {
  const held = { held: true, held_by: [0] };

  it("waits, says where the money went and offers to buy", () => {
    expect(verdict(held, { forgone: brl(18095) })).toEqual({
      title: "Espera neste mês",
      body: "R$ 18095 foram para os outros ativos",
      action: "release",
    });
  });

  it("says why it waits before an amount is typed", () => {
    expect(verdict(held).body).toBe("você respondeu não");
  });

  it("says that every asset was waiting", () => {
    expect(verdict(held, { holdsIgnored: true })).toEqual({
      title: "Todos estavam esperando",
      body: "Este aporte foi dividido sem as condições",
    });
  });

  it("offers to wait again while a held asset is free", () => {
    expect(verdict({ released: true, held_by: [0] })).toMatchObject({
      title: "Liberado só neste mês",
      action: "wait",
    });
    expect(verdict({ released: true }).action).toBeUndefined();
  });

  it.each([
    ["a warning", { warned_by: [0] }, [own], "Compra normal, com aviso"],
    ["no criterion", {}, [], "Sem critério"],
    ["an answer yes", { answers: [true] }, [own], "Liberado"],
    ["no answer", {}, [own], "Liberado"],
    [
      "criteria that only warn",
      {},
      [{ ...own, effect: "warn" as const }],
      "Compra normal",
    ],
    [
      "one that does not count",
      {},
      [{ ...own, counts: false }],
      "Compra normal",
    ],
  ])("with %s", (_, member, criteria, title) => {
    expect(verdict(member, { criteria }).title).toBe(title);
  });

  it("states the points and the ideal where the criteria set it", () => {
    const weighs = [{ ...own, effect: "weigh" as const }];
    const cls = group({ question_ideals: true });

    expect(
      verdict({ answers: [true], target_bp: 1800 }, { criteria: weighs, cls })
        .body,
    ).toBe("1 de 1 pontos · ideal 18% do grupo");
    expect(
      verdict(
        { target_bp: 5000 },
        { criteria: weighs.map((c) => ({ ...c, fact: "roe_min" })), cls },
      ).body,
    ).toBe("sem pontos: parte igual · ideal 50% do grupo");
  });
});

describe("groupVerdict", () => {
  const of = (cls: Group, holdsIgnored = false) =>
    groupVerdict({
      t,
      money: (m) => `R$ ${String(m.amount)}`,
      cls,
      forgone: brl(500),
      holdsIgnored,
    });

  it.each([
    ["held", group({ held: true }), "Espera neste mês", "release"],
    [
      "free this month",
      group({
        members: [
          { instrument: "A", value: brl(0), released: true, held_by: [0] },
        ],
      }),
      "Liberado só neste mês",
      "wait",
    ],
    ["with criteria", group(), "Compra normal", undefined],
    ["without any", group({ questions: [] }), "Sem critério", undefined],
  ])("%s", (_, cls, title, action) => {
    expect(of(cls)).toMatchObject({ title });
    expect(of(cls).action).toBe(action);
  });

  it("says that every asset was waiting", () => {
    expect(of(group({ held: true }), true).title).toBe(
      "Todos estavam esperando",
    );
  });
});
