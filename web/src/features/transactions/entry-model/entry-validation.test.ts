import { describe, expect, it } from "vitest";

import { emptyDraft } from "@/features/transactions/entry-model/entry-kind";
import { draftProblems } from "@/features/transactions/entry-model/entry-validation";

describe("draftProblems", () => {
  it("names each missing field of a simple kind", () => {
    expect(draftProblems(emptyDraft("2026-10-10"), new Map(), "BRL")).toEqual({
      amount: "entry.required.amount",
      account: "entry.required.account",
      category: "entry.required.category",
    });
    expect(
      draftProblems(
        {
          ...emptyDraft("2026-10-10"),
          kind: "transfer",
          amount: 1,
          accountId: "a",
        },
        new Map(),
        "BRL",
      ),
    ).toEqual({ to: "entry.required.account" });
  });

  it("asks every advanced row for an account and an amount, and the rows for a zero sum", () => {
    const draft = {
      ...emptyDraft("2026-10-10"),
      kind: "advanced" as const,
      rows: [
        { accountId: "a", amount: -100, memo: "" },
        { accountId: null, amount: 0, memo: "" },
      ],
    };
    expect(draftProblems(draft, new Map(), "BRL")).toEqual({
      "postings[1].account_id": "entry.required.account",
      postings: "entry.required.balance",
    });
  });
});

describe("draftProblems of an account in another currency", () => {
  const account = (id: string, cls: "asset" | "expense", currency: string) => ({
    id,
    name: id,
    class: cls,
    currency,
    opened_on: "2026-01-01",
    yield_mode: "none" as const,
  });
  const accounts = new Map(
    [
      account("checking", "asset", "BRL"),
      account("wallet", "asset", "USD"),
      account("food", "expense", "BRL"),
    ].map((a) => [a.id, a]),
  );

  it("asks for the value in the base currency", () => {
    const draft = {
      ...emptyDraft("2026-10-10"),
      amount: 1000,
      accountId: "wallet",
      categoryId: "food",
    };

    expect(draftProblems(draft, accounts, "BRL")).toEqual({
      baseAmount: "entry.required.baseAmount",
    });
    expect(
      draftProblems({ ...draft, baseAmount: 5483 }, accounts, "BRL"),
    ).toEqual({});
  });

  it("sends a transfer between two currencies to the exchange form", () => {
    const draft = {
      ...emptyDraft("2026-10-10"),
      kind: "transfer" as const,
      amount: 1000,
      accountId: "checking",
      toAccountId: "wallet",
    };

    expect(draftProblems(draft, accounts, "BRL")).toEqual({
      to: "entry.transfer.currencies",
    });
  });

  it("asks an advanced row for its value and balances the rows by it", () => {
    const draft = {
      ...emptyDraft("2026-10-10"),
      kind: "advanced" as const,
      rows: [
        { accountId: "wallet", amount: -1000, memo: "" },
        { accountId: "food", amount: 5483, memo: "" },
      ],
    };

    expect(draftProblems(draft, accounts, "BRL")).toEqual({
      "postings[0].weight": "entry.required.baseAmount",
    });
    expect(
      draftProblems(
        {
          ...draft,
          rows: [
            { accountId: "wallet", amount: -1000, baseAmount: 5483, memo: "" },
            { accountId: "food", amount: 5483, memo: "" },
          ],
        },
        accounts,
        "BRL",
      ),
    ).toEqual({});
  });
});
