import { describe, expect, it } from "vitest";

import { emptyCardSetup } from "@/features/accounts";

import { canContinue, startDrafts } from "@/features/start/start-drafts";
import type { StartKind, StartRow } from "@/features/start/start-drafts";

const labels = {
  checking: "checking",
  savings: "savings",
  credit_card: "credit card",
  cash: "cash",
};

const ctx = {
  today: "2026-11-01",
  currency: "BRL",
  kindLabel: (kind: StartKind | "cash") => labels[kind],
  cashName: "Cash",
};

const emptyRow: StartRow = {
  key: "r0",
  institutionId: null,
  institutionName: "",
  kinds: [],
};

function rowWith(
  id: string,
  kinds: readonly StartKind[],
  name = "Nubank",
): StartRow {
  return { key: id, institutionId: id, institutionName: name, kinds };
}

describe("canContinue", () => {
  const cases: {
    name: string;
    rows: readonly StartRow[];
    cash: boolean;
    want: boolean;
  }[] = [
    { name: "nothing chosen", rows: [], cash: false, want: false },
    { name: "cash only", rows: [], cash: true, want: true },
    { name: "empty row", rows: [emptyRow], cash: false, want: false },
    {
      name: "institution without kind",
      rows: [rowWith("i1", [])],
      cash: true,
      want: false,
    },
    {
      name: "institution with a kind",
      rows: [rowWith("i1", ["checking"])],
      cash: false,
      want: true,
    },
    {
      name: "empty row beside a complete row",
      rows: [emptyRow, rowWith("i1", ["checking"])],
      cash: false,
      want: true,
    },
  ];

  it.each(cases)("$name", ({ rows, cash, want }) => {
    expect(canContinue(rows, cash)).toBe(want);
  });
});

describe("startDrafts", () => {
  it("names accounts by institution and kind, in startKinds order", () => {
    const drafts = startDrafts(
      [rowWith("i1", ["credit_card", "checking"]), emptyRow],
      true,
      ctx,
    );

    expect(drafts.map((d) => d.name)).toEqual([
      "Nubank checking",
      "Nubank credit card",
      "Cash",
    ]);
    expect(drafts.map((d) => d.kind)).toEqual([
      "checking",
      "credit_card",
      "cash",
    ]);
    expect(drafts.map((d) => d.institutionId)).toEqual(["i1", "i1", null]);
    expect(drafts.map((d) => d.openedOn)).toEqual(Array(3).fill(ctx.today));
    expect(drafts.map((d) => d.currency)).toEqual(Array(3).fill(ctx.currency));
    expect(drafts.map((d) => d.opening)).toEqual([0, 0, 0]);
    expect(drafts.map((d) => d.card)).toEqual(Array(3).fill(emptyCardSetup()));
  });

  it("returns no draft without a row and without cash", () => {
    expect(startDrafts([emptyRow], false, ctx)).toEqual([]);
  });
});
