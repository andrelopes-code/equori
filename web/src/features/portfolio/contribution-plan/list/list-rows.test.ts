import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  dueCount,
  listSections,
  rowsOf,
} from "@/features/portfolio/contribution-plan/list/list-rows";

type Plan = components["schemas"]["ContributionPlan"];
type Group = Plan["classes"][number];
type Member = Group["members"][number];

const brl = (amount: number) => ({ amount, currency: "BRL" });
const names = (ref: { account_id?: string; instrument?: string }) =>
  ref.instrument ?? ref.account_id ?? "";

const group = (
  name: string,
  members: Member[],
  over: Partial<Group> = {},
): Group => ({
  name,
  target_bp: 5000,
  value: brl(0),
  amount: brl(0),
  questions: [],
  question_facts: [],
  question_limits: [],
  question_effects: [],
  question_reviews: [],
  question_ideals: false,
  held: false,
  rules: [],
  matched: [],
  members,
  ...over,
});
const asset = (instrument: string, over: Partial<Member> = {}): Member => ({
  instrument,
  value: brl(0),
  ...over,
});
const bought = (instrument: string, cost: number, over = {}) =>
  asset(instrument, {
    amount: brl(cost),
    cost: brl(cost),
    unit_value: brl(100),
    quantity: { amount: cost / 100, currency: instrument },
    ...over,
  });
const plan = (classes: Group[], over: Partial<Plan> = {}): Plan => ({
  status: "complete",
  total: brl(0),
  revision: 1,
  holds_ignored: false,
  outside: [],
  missing: [],
  classes,
  ...over,
});
const unsplit = (cls: Group): Group => {
  const rest = { ...cls };
  delete rest.amount;

  return rest;
};
const held = { held: true, held_by: [1], forgone: brl(500) };

describe("listSections", () => {
  it("separates what to buy, what waits and what receives nothing", () => {
    const got = listSections(
      plan([
        group("A", [bought("AAAA3", 200)]),
        group("B", [
          bought("BBBB3", 300, { target_bp: 6000 }),
          asset("CCCC3", { target_bp: 4000, amount: brl(0), cost: brl(0) }),
        ]),
        group("C", [asset("DDDD3", { amount: brl(0), ...held })], {
          held: true,
        }),
      ]),
      names,
    );

    expect(got.buy.map((r) => [r.key, r.entry?.cost.amount])).toEqual([
      ["B/BBBB3", 300],
      ["A/AAAA3", 200],
    ]);
    expect(got.wait.map((r) => [r.key, r.heldBy])).toEqual([["C/DDDD3", 1]]);
    expect(got.none.map((r) => [r.key, r.reason])).toEqual([
      ["B/CCCC3", "atIdeal"],
    ]);
    expect(rowsOf(got)).toHaveLength(4);
  });

  it("says why an asset receives nothing", () => {
    const got = listSections(
      plan([
        group("A", [
          asset("AAAA3", { target_bp: 0, amount: brl(0), cost: brl(0) }),
          asset("BBBB3", { target_bp: 10000, amount: brl(90), cost: brl(0) }),
        ]),
        group("B", [], { target_bp: 0 }),
      ]),
      names,
    );

    expect(got.none.map((r) => r.reason)).toEqual([
      "noIdeal",
      "small",
      "noIdeal",
    ]);
  });

  it("keeps every asset before an amount is typed", () => {
    const got = listSections(
      plan([
        unsplit(group("A", [asset("AAAA3")])),
        unsplit(group("B", [asset("BBBB3", held)], { held: true })),
      ]),
      names,
    );

    expect(got.split).toBe(false);
    expect(got.buy.map((r) => r.name)).toEqual(["AAAA3"]);
    expect(got.wait.map((r) => r.name)).toEqual(["BBBB3"]);
    expect(got.none).toEqual([]);
  });

  it("lists held assets among the purchases when the holds were ignored", () => {
    const got = listSections(
      plan([group("A", [bought("AAAA3", 200, { held: true, held_by: [0] })])], {
        holds_ignored: true,
      }),
      names,
    );

    expect(got.wait).toEqual([]);
    expect(got.buy[0]).toMatchObject({ name: "AAAA3", flag: "wouldWait" });
  });

  it("names the held assets of a group bought as a whole", () => {
    const got = listSections(
      plan([
        group("A", [asset("AAAA3", held), asset("BBBB3")], {
          amount: brl(500),
          cost: brl(500),
        }),
      ]),
      names,
    );

    expect(got.buy[0]).toMatchObject({ key: "A/", without: ["AAAA3"] });
    expect(got.buy[0]?.member).toBeUndefined();
  });

  it("waits a group bought as a whole when all of its assets do", () => {
    const got = listSections(
      plan([
        group("A", [asset("AAAA3", held), asset("BBBB3", held)], {
          held: true,
        }),
      ]),
      names,
    );

    expect(got.wait.map((r) => r.name)).toEqual(["A"]);
  });

  it.each([
    ["due", { due: [0], released: true, held_by: [0], warned_by: [0] }, "due"],
    ["released", { released: true, held_by: [0], warned_by: [0] }, "released"],
    ["released without a hold", { released: true }, undefined],
    ["warned", { warned_by: [0] }, "warned"],
    ["nothing", {}, undefined],
  ])("flags an asset %s", (_, over, flag) => {
    const [row] = listSections(
      plan([group("A", [bought("AAAA3", 200, over)])]),
      names,
    ).buy;

    expect(row?.flag).toBe(flag);
  });

  it("flags a group bought as a whole by its assets", () => {
    const [row] = listSections(
      plan([
        group(
          "A",
          [asset("AAAA3", { warned_by: [0] }), asset("B", { due: [0] })],
          {
            amount: brl(500),
          },
        ),
      ]),
      names,
    ).buy;

    expect(row?.flag).toBe("due");
  });
});

describe("dueCount", () => {
  it("counts the due answers of every asset", () => {
    expect(
      dueCount(
        plan([
          group("A", [asset("AAAA3", { due: [0, 2] }), asset("BBBB3")]),
          group("B", [asset("CCCC3", { due: [1] })]),
        ]),
      ),
    ).toBe(3);
  });
});
