import { describe, expect, it } from "vitest";

import { emptyDraft } from "@/features/transactions/entry-kind";
import { draftProblems } from "@/features/transactions/entry-validation";

describe("draftProblems", () => {
  it("names each missing field of a simple kind", () => {
    expect(draftProblems(emptyDraft("2026-10-10"))).toEqual({
      amount: "entry.required.amount",
      account: "entry.required.account",
      category: "entry.required.category",
    });
    expect(
      draftProblems({
        ...emptyDraft("2026-10-10"),
        kind: "transfer",
        amount: 1,
        accountId: "a",
      }),
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
    expect(draftProblems(draft)).toEqual({
      "postings[1].account_id": "entry.required.account",
      postings: "entry.required.balance",
    });
  });
});
