import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { draftOf } from "@/features/transactions/capture-draft";
import {
  attentionCount,
  readRows,
  suggestedRows,
} from "@/features/transactions/capture-rows";
import type { ReadRow } from "@/features/transactions/capture-rows";

type Account = components["schemas"]["Account"];
type CaptureLine = components["schemas"]["CaptureLine"];

const accounts = new Map<string, Account>([
  [
    "checking",
    {
      id: "checking",
      name: "checking",
      class: "asset",
      kind: "checking",
      currency: "BRL",
      opened_on: "2026-01-01",
      yield_mode: "none",
    },
  ],
]);

describe("readRows", () => {
  it("applies each line's override by its key", () => {
    const lines = [line(), line({ description: "Padaria" })];
    const edited = { ...draftOf(line()), description: "Feira" };

    const rows = readRows(lines, ["a", "b"], { b: { edited } }, accounts);

    expect(rows.map((r) => [r.key, r.draft.description, r.edited])).toEqual([
      ["a", "Mercado", false],
      ["b", "Feira", true],
    ]);
  });

  it("keys a line without a key by its index", () => {
    const rows = readRows([line()], [], {}, accounts);

    expect(rows[0]?.key).toBe("0");
  });

  it("checks problems only on a line without issues", () => {
    const zero = { amount: 0, currency: "BRL" };
    const issue = { code: "ambiguous_amount", field: "amount", choices: [] };
    const lines = [
      line({ amount: zero }),
      line({ amount: zero, issues: [issue] as never }),
    ];

    const rows = readRows(lines, ["a", "b"], {}, accounts);

    expect(rows.map((r) => r.problems)).toEqual([
      ["capture.problem.amount"],
      [],
    ]);
  });
});

describe("suggestedRows", () => {
  it("fills an empty category of an unedited row", () => {
    const read = readRows([line()], ["a"], {}, accounts);
    const suggestions = [
      { description: "Mercado", kind: "expense", categoryId: "food" },
    ];

    const rows = suggestedRows(read, suggestions);

    expect(rows[0]?.draft.categoryId).toBe("food");
    expect(rows[0]?.suggested).toBe(true);
  });

  it("keeps a category the reading set and leaves an edited row alone", () => {
    const edited = draftOf(line());
    const read = readRows(
      [line({ category_id: "rent" }), line()],
      ["a", "b"],
      { b: { edited } },
      accounts,
    );
    const suggestions = [
      { description: "Mercado", kind: "expense", categoryId: "food" },
    ];

    const rows = suggestedRows(read, suggestions);

    expect(rows.map((r) => [r.draft.categoryId, r.suggested])).toEqual([
      ["rent", false],
      [null, false],
    ]);
  });
});

describe("attentionCount", () => {
  it("counts rows with an issue or a problem", () => {
    const rows = [
      row({ issues: [], problems: [] }),
      row({ issues: [{}], problems: [] }),
      row({ issues: [], problems: ["capture.problem.amount"] }),
    ];

    expect(attentionCount(rows)).toBe(2);
  });
});

function line(extra: Partial<CaptureLine> = {}): CaptureLine {
  return {
    line: 1,
    text: "mercado 230",
    segments: [{ text: "mercado 230", role: "text" }],
    kind: "expense",
    amount: { amount: 23000, currency: "BRL" },
    date: "2026-10-20",
    account_id: "checking",
    account_source: "text",
    description: "Mercado",
    tags: [],
    issues: [],
    ...extra,
  };
}

function row(parts: { issues: object[]; problems: string[] }): ReadRow {
  return parts as never;
}
