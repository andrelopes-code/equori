import { describe, expect, it } from "vitest";

import {
  memberRefOf,
  planFromPortfolio,
  typeOfEntry,
} from "@/features/portfolio/contribution-plan/model/plan-from-portfolio";
import type { TypedEntry } from "@/features/portfolio/contribution-plan/model/plan-from-portfolio";

const brl = (amount: number) => ({ amount, currency: "BRL" });

const entry = (
  instrument: string,
  type: string,
  value?: number,
): TypedEntry => ({
  entry: { instrument, ...(value === undefined ? {} : { value: brl(value) }) },
  type,
});

const label = (type: string) => `L:${type}`;
const kindLabel = (kind: string) => `K:${kind}`;

const contract = (
  instrument: string,
  value: number,
  returnKind?: "rate" | "inflation" | "fixed",
): TypedEntry => ({
  ...entry(instrument, "fixed_income", value),
  ...(returnKind === undefined ? {} : { returnKind }),
});

const targets = (entries: TypedEntry[]) =>
  planFromPortfolio(entries, label, kindLabel).classes.map((c) => [
    c.name,
    c.targetBp,
  ]);

describe("planFromPortfolio", () => {
  it("makes one class per type in order of first appearance, with the shares of the values", () => {
    const entries: TypedEntry[] = [
      entry("PETR4", "stock", 5000),
      {
        entry: { account_id: "acc-1", value: brl(500) },
        type: "currency",
      },
      entry("MXRF11", "reit", 1500),
      entry("VALE3", "stock", 3000),
    ];

    expect(planFromPortfolio(entries, label, kindLabel)).toEqual({
      classes: [
        {
          name: "L:stock",
          targetBp: 8000,
          byQuestions: false,
          questions: [],
          rules: [],
          members: [{ instrument: "PETR4" }, { instrument: "VALE3" }],
        },
        {
          name: "L:currency",
          targetBp: 500,
          byQuestions: false,
          questions: [],
          rules: [],
          members: [{ accountId: "acc-1" }],
        },
        {
          name: "L:reit",
          targetBp: 1500,
          byQuestions: false,
          questions: [],
          rules: [],
          members: [{ instrument: "MXRF11" }],
        },
      ],
    });
  });

  it("gives the remainder of the rounding to the largest class", () => {
    expect(targets([entry("A", "stock", 2), entry("B", "reit", 1)])).toEqual([
      ["L:stock", 6667],
      ["L:reit", 3333],
    ]);
  });

  it("gives the remainder to the first of the largest classes on a tie", () => {
    expect(
      targets([
        entry("A", "stock", 1),
        entry("B", "reit", 1),
        entry("C", "fund", 1),
      ]),
    ).toEqual([
      ["L:stock", 3334],
      ["L:reit", 3333],
      ["L:fund", 3333],
    ]);
  });

  it("keeps an entry without a value as a member with no weight", () => {
    const draft = planFromPortfolio(
      [
        entry("A", "stock", 100),
        entry("B", "stock"),
        entry("C", "reit", 100),
        entry("D", "fund"),
      ],
      label,
      kindLabel,
    );

    expect(draft.classes.map((c) => [c.targetBp, c.members.length])).toEqual([
      [5000, 2],
      [5000, 1],
      [0, 1],
    ]);
  });

  it("puts the whole target on the first class when no entry has a value", () => {
    expect(targets([entry("A", "stock"), entry("B", "reit")])).toEqual([
      ["L:stock", 10000],
      ["L:reit", 0],
    ]);
  });

  it("sums to 10000 with values above the safe integer range", () => {
    const big = 9_000_000_000_000_000;
    const sum = planFromPortfolio(
      [entry("A", "stock", big), entry("B", "reit", big * 2 + 1)],
      label,
      kindLabel,
    ).classes.reduce((acc, c) => acc + c.targetBp, 0);

    expect(sum).toBe(10000);
  });
});

describe("planFromPortfolio by return kind", () => {
  const entries: TypedEntry[] = [
    contract("CDB1", 3000, "rate"),
    contract("NTNB.20350515", 2000, "inflation"),
    contract("CDB2", 1000, "rate"),
    contract("CRI1", 1000),
    entry("PETR4", "stock", 3000),
  ];

  it("makes one class per return kind with its rule and no member", () => {
    const classes = planFromPortfolio(entries, label, kindLabel).classes;

    expect(classes.slice(0, 2)).toEqual([
      {
        name: "K:rate",
        targetBp: 4000,
        byQuestions: false,
        questions: [],
        rules: [{ instrument_type: "fixed_income", return_kind: "rate" }],
        members: [],
      },
      {
        name: "K:inflation",
        targetBp: 2000,
        byQuestions: false,
        questions: [],
        rules: [{ instrument_type: "fixed_income", return_kind: "inflation" }],
        members: [],
      },
    ]);
  });

  it("keeps a contract without a return kind as a member of its type class", () => {
    const classes = planFromPortfolio(entries, label, kindLabel).classes;

    expect(classes.slice(2)).toEqual([
      {
        name: "L:fixed_income",
        targetBp: 1000,
        byQuestions: false,
        questions: [],
        rules: [],
        members: [{ instrument: "CRI1" }],
      },
      {
        name: "L:stock",
        targetBp: 3000,
        byQuestions: false,
        questions: [],
        rules: [],
        members: [{ instrument: "PETR4" }],
      },
    ]);
  });

  it("sums the targets to 10000", () => {
    const sum = planFromPortfolio(entries, label, kindLabel).classes.reduce(
      (acc, c) => acc + c.targetBp,
      0,
    );

    expect(sum).toBe(10000);
  });

  it("does not make a rule of a stock that carries a return kind", () => {
    const stock = { ...entry("X", "stock", 1), returnKind: "rate" } as const;

    expect(
      planFromPortfolio([stock], label, kindLabel).classes[0]?.rules,
    ).toEqual([]);
  });
});

describe("typeOfEntry", () => {
  const types = new Map([["PETR4", "stock"]]);

  it("reads the type of an instrument from the catalog", () => {
    expect(typeOfEntry({ instrument: "PETR4" }, types)).toBe("stock");
  });

  it("counts an account as a currency", () => {
    expect(typeOfEntry({ account_id: "acc-1" }, types)).toBe("currency");
  });
});

describe("memberRefOf", () => {
  it("carries the account and the instrument the entry has", () => {
    expect(memberRefOf({ instrument: "PETR4" })).toEqual({
      instrument: "PETR4",
    });
    expect(memberRefOf({ account_id: "acc-1" })).toEqual({
      accountId: "acc-1",
    });
  });
});
