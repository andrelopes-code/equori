import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  draftOf,
  entryOf,
  issuesOf,
  lineKeys,
  overrideWithChoice,
  pruneOverrides,
  problemsOf,
  suggestionItems,
} from "@/features/transactions/capture-draft";
import type { LineDraft } from "@/features/transactions/capture-draft";

type Account = components["schemas"]["Account"];
type CaptureLine = components["schemas"]["CaptureLine"];

function account(
  id: string,
  cls: Account["class"],
  extra: Partial<Account> = {},
): Account {
  return {
    id,
    name: id,
    class: cls,
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...extra,
  };
}

const accounts = new Map(
  [
    account("checking", "asset", { kind: "checking" }),
    account("visa", "liability", { kind: "credit_card" }),
    account("wallet", "asset", { kind: "cash" }),
    account("food", "expense"),
    account("open-expense", "expense", {
      system_role: "uncategorized_expense",
    }),
    account("open-income", "income", { system_role: "uncategorized_income" }),
  ].map((a) => [a.id, a]),
);

const brl = (amount: number) => ({ amount, currency: "BRL" });

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item ${String(index)}`);
  return item;
}

// The line without the optional members named, which a reading leaves out.
function without(l: CaptureLine, ...keys: (keyof CaptureLine)[]): CaptureLine {
  const out: Partial<CaptureLine> = { ...l };
  for (const k of keys) Reflect.deleteProperty(out, k);
  return out as CaptureLine;
}

function line(extra: Partial<CaptureLine> = {}): CaptureLine {
  return {
    line: 1,
    text: "mercado 230 nubank",
    segments: [{ text: "mercado 230 nubank", role: "text" }],
    kind: "expense",
    amount: brl(23000),
    date: "2026-10-20",
    account_id: "checking",
    account_source: "text",
    description: "Mercado",
    tags: [],
    issues: [],
    ...extra,
  };
}

describe("lineKeys", () => {
  it("keys equal lines by their occurrence", () => {
    const lines = [
      line({ text: "café 5" }),
      line({ text: "pão 8" }),
      line({ text: "café 5" }),
    ];
    expect(lineKeys(lines)).toEqual(["1\ncafé 5", "1\npão 8", "2\ncafé 5"]);
  });
});

describe("draftOf", () => {
  it("reads the line", () => {
    const d = draftOf(
      line({ category_id: "food", payee_id: "p", installments: 3 }),
    );
    expect(d).toEqual<LineDraft>({
      kind: "expense",
      amount: 23000,
      date: "2026-10-20",
      accountId: "checking",
      toAccountId: null,
      categoryId: "food",
      payeeId: "p",
      statement: null,
      description: "Mercado",
      tags: [],
      rows: [],
      installments: 3,
    });
  });

  it("puts a chosen field over the reading, and an edit over both", () => {
    const l = without(line(), "amount");
    expect(draftOf(l, { chosen: { amount: 1500 } }).amount).toBe(1500);
    const edited = { ...draftOf(l), amount: 900, description: "Pão" };
    expect(draftOf(l, { chosen: { amount: 1500 }, edited })).toBe(edited);
  });
});

describe("issuesOf", () => {
  const ambiguous = without(
    line({
      issues: [
        {
          code: "ambiguous_amount",
          field: "amount",
          choices: [
            { amount: brl(200), description: "Padaria irmãos 15" },
            { amount: brl(1500), description: "Padaria 2 irmãos" },
          ],
        },
        { code: "missing_account", field: "account", choices: [] },
      ],
    }),
    "amount",
    "account_id",
  );

  it("keeps the issues whose field nothing chose", () => {
    const override = overrideWithChoice(
      undefined,
      at(ambiguous.issues, 0),
      at(at(ambiguous.issues, 0).choices, 1),
    );
    expect(override.chosen).toEqual({
      amount: 1500,
      description: "Padaria 2 irmãos",
    });
    expect(issuesOf(ambiguous, override).map((i) => i.code)).toEqual([
      "missing_account",
    ]);
  });

  it("drops every issue once the line was edited", () => {
    expect(
      issuesOf(ambiguous, { edited: { ...draftOf(ambiguous), amount: 5 } }),
    ).toEqual([]);
  });

  it("takes the description a near account's choice carries", () => {
    const issue = {
      code: "possible_account" as const,
      field: "account" as const,
      choices: [{ account_id: "checking", description: "Almoço" }],
    };
    expect(overrideWithChoice(undefined, issue, at(issue.choices, 0))).toEqual({
      chosen: { accountId: "checking", description: "Almoço" },
    });
  });

  it("chooses the account of an account issue, by its field", () => {
    const issue = {
      code: "ambiguous_account" as const,
      field: "to_account" as const,
      choices: [{ account_id: "wallet" }],
    };
    expect(
      overrideWithChoice(
        { chosen: { amount: 5 } },
        issue,
        at(issue.choices, 0),
      ),
    ).toEqual({ chosen: { amount: 5, toAccountId: "wallet" } });
  });
});

describe("problemsOf", () => {
  const base = draftOf(line());

  it("accepts a complete line without a category", () => {
    expect(problemsOf(base, accounts)).toEqual([]);
  });

  it("names what an edited line lacks", () => {
    expect(
      problemsOf({ ...base, amount: 0, accountId: null }, accounts),
    ).toEqual(["capture.problem.amount", "capture.problem.account"]);
    expect(
      problemsOf(
        { ...base, kind: "transfer", toAccountId: "checking" },
        accounts,
      ),
    ).toEqual(["capture.problem.sameAccount"]);
    expect(
      problemsOf({ ...base, kind: "transfer", toAccountId: null }, accounts),
    ).toEqual(["capture.problem.destination"]);
    expect(problemsOf({ ...base, installments: 3 }, accounts)).toEqual([
      "capture.problem.installments",
    ]);
    expect(
      problemsOf({ ...base, installments: 3, accountId: "visa" }, accounts),
    ).toEqual([]);
  });

  it("checks the rows of an advanced edit", () => {
    expect(
      problemsOf(
        {
          ...base,
          kind: "advanced",
          rows: [
            { accountId: "checking", amount: -100, memo: "" },
            { accountId: "food", amount: 90, memo: "" },
          ],
        },
        accounts,
      ),
    ).toEqual(["capture.problem.rows"]);
  });
});

describe("entryOf", () => {
  it("records an uncategorized expense against the uncategorized account", () => {
    expect(entryOf(draftOf(line()), accounts, "BRL")).toEqual({
      transaction: {
        date: "2026-10-20",
        description: "Mercado",
        postings: [
          { account_id: "checking", amount: brl(-23000) },
          { account_id: "open-expense", amount: brl(23000) },
        ],
      },
    });
  });

  it("records income against its category", () => {
    const d = {
      ...draftOf(line({ kind: "income", category_id: "food" })),
      tags: ["x"],
    };
    expect(entryOf(d, accounts, "BRL")).toEqual({
      transaction: {
        date: "2026-10-20",
        description: "Mercado",
        tags: ["x"],
        postings: [
          { account_id: "checking", amount: brl(23000) },
          { account_id: "food", amount: brl(-23000) },
        ],
      },
    });
  });

  it("records a transfer without payee", () => {
    const d = draftOf(
      line({
        kind: "transfer",
        to_account_id: "wallet",
        payee_id: "p",
        description: "",
      }),
    );
    expect(entryOf(d, accounts, "BRL")).toEqual({
      transaction: {
        date: "2026-10-20",
        postings: [
          { account_id: "checking", amount: brl(-23000) },
          { account_id: "wallet", amount: brl(23000) },
        ],
      },
    });
  });

  it("records a card purchase in installments", () => {
    const d = draftOf(
      line({
        account_id: "visa",
        installments: 3,
        payee_id: "p",
        category_id: "food",
      }),
    );
    expect(entryOf(d, accounts, "BRL")).toEqual({
      installment_purchase: {
        card_account_id: "visa",
        date: "2026-10-20",
        description: "Mercado",
        payee_id: "p",
        splits: [{ account_id: "food", amount: brl(23000) }],
        installment_count: 3,
      },
    });
  });
});

describe("pruneOverrides", () => {
  it("drops the overrides of lines no longer in the text", () => {
    expect(
      pruneOverrides(
        {
          "1\na": { chosen: { amount: 1 } },
          "1\nb": { chosen: { amount: 2 } },
        },
        ["1\nb"],
      ),
    ).toEqual({ "1\nb": { chosen: { amount: 2 } } });
  });
});

describe("suggestionItems", () => {
  const row = (
    d: Partial<LineDraft>,
    extra: { edited?: boolean; issues?: unknown[] } = {},
  ) => ({
    draft: { ...draftOf(line()), ...d },
    edited: extra.edited ?? false,
    issues: extra.issues ?? [],
    problems: [],
  });

  it("asks once per description for complete uncategorized expense and income drafts", () => {
    expect(
      suggestionItems([
        row({ description: "Padaria" }),
        row({ description: " Padaria " }),
        row({ description: "Freela", kind: "income" }),
        row({ description: "Mercado", categoryId: "food" }),
        row({ description: "Reserva", kind: "transfer" }),
        row({ description: "" }),
        row({ description: "Editada" }, { edited: true }),
        row({ description: "Com aviso" }, { issues: [{}] }),
      ]),
    ).toEqual([
      { description: "Padaria", kind: "expense" },
      { description: "Freela", kind: "income" },
    ]);
  });
});
