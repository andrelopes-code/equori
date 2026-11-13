import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { sheetRows } from "@/features/accounts/balance-sheet/balance-sheet";
import {
  sheetLines,
  type SheetLine,
} from "@/features/accounts/balance-sheet/sheet-lines";

type Account = components["schemas"]["Account"];

describe("sheetLines", () => {
  it("shows the children of an open parent and folds the positions into one line", () => {
    const lines = sheetLines(fixture(), {
      closed: new Set(),
      positionsOpen: new Set(),
    });

    expect(summary(lines)).toEqual([
      "account broker 0 open",
      "account cash 1 first",
      "account savings 1",
      "positions broker 1 count=3 codes=ITUB4,PETR4,WEGE3 closed last",
    ]);
  });

  it("lists the positions as children when they are open", () => {
    const lines = sheetLines(fixture(), {
      closed: new Set(),
      positionsOpen: new Set(["broker"]),
    });

    expect(summary(lines)).toEqual([
      "account broker 0 open",
      "account cash 1 first",
      "account savings 1",
      "positions broker 1 count=3 codes=ITUB4,PETR4,WEGE3 open",
      "account itub4 1",
      "account petr4 1",
      "account wege3 1 last",
    ]);
  });

  it("hides everything under a closed parent", () => {
    const lines = sheetLines(fixture(), {
      closed: new Set(["broker"]),
      positionsOpen: new Set(["broker"]),
    });

    expect(summary(lines)).toEqual(["account broker 0 closed"]);
  });

  it("marks the last child when a parent has no positions", () => {
    const rows = sheetRows(
      { items: [item("p", undefined), item("a", "p"), item("b", "p")] },
      "en-US",
      { base: "BRL" },
    );

    const lines = sheetLines(rows, {
      closed: new Set(),
      positionsOpen: new Set(),
    });

    expect(summary(lines)).toEqual([
      "account p 0 open",
      "account a 1 first",
      "account b 1 last",
    ]);
  });

  it("marks the only child as first and last", () => {
    const rows = sheetRows(
      { items: [item("p", undefined), item("a", "p")] },
      "en-US",
      { base: "BRL" },
    );

    const lines = sheetLines(rows, {
      closed: new Set(),
      positionsOpen: new Set(),
    });

    expect(summary(lines)).toEqual([
      "account p 0 open",
      "account a 1 first last",
    ]);
  });
});

function fixture() {
  return sheetRows(
    {
      items: [
        item("broker", undefined),
        item("cash", "broker", "BRL", 100),
        item("savings", "broker", "BRL", 50),
        item("wege3", "broker", "WEGE3", 150),
        item("itub4", "broker", "ITUB4", 509),
        item("petr4", "broker", "PETR4", 238),
      ],
    },
    "en-US",
    { base: "BRL", order: "balance" },
  );
}

function summary(lines: SheetLine[]): string[] {
  return lines.map((line) => {
    if (line.type === "positions") {
      return [
        "positions",
        line.parentId,
        line.depth,
        `count=${String(line.count)}`,
        `codes=${line.codes.join(",")}`,
        line.open ? "open" : "closed",
        ...flags(line),
      ].join(" ");
    }
    return [
      "account",
      line.row.account.id,
      line.row.depth,
      ...(line.row.hasChildren ? [line.open ? "open" : "closed"] : []),
      ...flags(line),
    ].join(" ");
  });
}

function flags(line: { first: boolean; last: boolean }): string[] {
  return [...(line.first ? ["first"] : []), ...(line.last ? ["last"] : [])];
}

function item(
  id: string,
  parentID: string | undefined,
  currency = "BRL",
  amount = 0,
) {
  const account: Account = {
    id,
    name: id,
    class: "asset",
    kind: "brokerage",
    currency,
    ...(parentID === undefined ? {} : { parent_id: parentID }),
  };
  return { account, balance: { amount, currency } };
}
