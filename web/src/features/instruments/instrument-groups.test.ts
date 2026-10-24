import { describe, expect, it } from "vitest";

import {
  groupByType,
  latestPrice,
} from "@/features/instruments/instrument-groups";

const item = (code: string, type: string) =>
  ({ code, type, scale: 2, name: code }) as never;

describe("groupByType", () => {
  it("lists the types in contract order and keeps the code order inside a type", () => {
    const groups = groupByType([
      item("BRL", "currency"),
      item("CDB1", "fixed_income"),
      item("PETR4", "stock"),
      item("VALE3", "stock"),
    ]);
    expect(groups.map((g) => [g.type, g.items.map((i) => i.code)])).toEqual([
      ["currency", ["BRL"]],
      ["stock", ["PETR4", "VALE3"]],
      ["fixed_income", ["CDB1"]],
    ]);
  });

  it("puts a type the contract does not list after the known ones, in name order", () => {
    const groups = groupByType([
      item("X2", "zeta"),
      item("X1", "alpha"),
      item("PETR4", "stock"),
    ]);
    expect(groups.map((g) => g.type)).toEqual(["stock", "alpha", "zeta"]);
  });
});

describe("latestPrice", () => {
  it("returns the price with the greatest date", () => {
    const price = (date: string, value: string) => ({ date, value }) as never;
    expect(
      latestPrice([
        price("2026-10-01", "1"),
        price("2026-10-09", "3"),
        price("2026-10-05", "2"),
      ]),
    ).toEqual({ date: "2026-10-09", value: "3" });
    expect(latestPrice([])).toBeUndefined();
  });
});
