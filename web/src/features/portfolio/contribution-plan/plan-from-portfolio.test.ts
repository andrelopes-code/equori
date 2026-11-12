import { describe, expect, it } from "vitest";

import {
  memberRefOf,
  planFromPortfolio,
  typeOfEntry,
} from "@/features/portfolio/contribution-plan/plan-from-portfolio";
import type { TypedEntry } from "@/features/portfolio/contribution-plan/plan-from-portfolio";

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

const targets = (entries: TypedEntry[]) =>
  planFromPortfolio(entries, label).classes.map((c) => [c.name, c.targetBp]);

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

    expect(planFromPortfolio(entries, label)).toEqual({
      classes: [
        {
          name: "L:stock",
          targetBp: 8000,
          members: [{ instrument: "PETR4" }, { instrument: "VALE3" }],
        },
        {
          name: "L:currency",
          targetBp: 500,
          members: [{ accountId: "acc-1" }],
        },
        {
          name: "L:reit",
          targetBp: 1500,
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
    ).classes.reduce((acc, c) => acc + c.targetBp, 0);

    expect(sum).toBe(10000);
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
