import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAccountDraft,
  draftProblems,
  emptyAccountDraft,
  readAccountDraft,
  writeAccountDraft,
} from "@/features/accounts/account-draft";

beforeEach(() => {
  sessionStorage.clear();
});

describe("account draft", () => {
  it("survives leaving the form and is gone once cleared", () => {
    const draft = {
      ...emptyAccountDraft("2026-10-17", "BRL"),
      kind: "savings" as const,
      name: "Poupança",
    };
    writeAccountDraft("new", draft);
    expect(readAccountDraft("new")).toEqual(draft);
    clearAccountDraft("new");
    expect(readAccountDraft("new")).toBeNull();
  });

  it("reads a stored value of another shape as no draft", () => {
    sessionStorage.setItem("equori.accountDraft.new", '{"kind": 3}');
    expect(readAccountDraft("new")).toBeNull();
  });

  it("names each field the account still needs", () => {
    const base = emptyAccountDraft("2026-10-17", "BRL");
    expect(draftProblems({ ...base, name: "  " }, "create")).toEqual({
      kind: "accountForm.problem.kind",
      name: "accountForm.problem.name",
    });
    expect(
      draftProblems(
        {
          ...base,
          kind: "credit_card",
          name: "Visa",
          card: {
            ...base.card,
            closingDay: null,
            dueDay: null,
            cards: [{ holder: "", lastFour: "12", virtual: false }],
          },
        },
        "create",
      ),
    ).toEqual({
      closing_day: "accountForm.problem.closingDay",
      due_day: "accountForm.problem.dueDay",
      "cards.0.holder": "accountForm.problem.holder",
      "cards.0.last_four": "accountForm.problem.lastFour",
    });
  });

  it("leaves a card's billing out of an edit, which shows no such fields", () => {
    const base = emptyAccountDraft("2026-10-17", "BRL");
    expect(
      draftProblems(
        {
          ...base,
          kind: "credit_card",
          name: "Visa",
          card: { ...base.card, closingDay: null, dueDay: null },
        },
        "edit",
      ),
    ).toEqual({});
  });
});
