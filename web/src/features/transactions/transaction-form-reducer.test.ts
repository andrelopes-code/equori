import { describe, expect, it } from "vitest";

import {
  canSave,
  formReducer,
  initialForm,
  toTransactionInput,
} from "@/features/transactions/transaction-form-reducer";
import type { FormState } from "@/features/transactions/transaction-form-reducer";

const checking = "11111111-1111-4111-8111-111111111111";
const food = "22222222-2222-4222-8222-222222222222";
const salary = "33333333-3333-4333-8333-333333333333";
const savings = "44444444-4444-4444-8444-444444444444";
const payee = "55555555-5555-4555-8555-555555555555";

const currencyOf = () => "BRL";

function filled(extra: Partial<FormState>): FormState {
  return {
    ...initialForm("2026-10-17", checking),
    amount: 12000,
    counterId: food,
    ...extra,
  };
}

describe("toTransactionInput", () => {
  const cases: {
    name: string;
    state: FormState;
    postings: { account_id: string; amount: number }[];
  }[] = [
    {
      name: "expense debits the account and credits the category",
      state: filled({ mode: "expense", counterId: food }),
      postings: [
        { account_id: checking, amount: -12000 },
        { account_id: food, amount: 12000 },
      ],
    },
    {
      name: "income credits the account and debits the category",
      state: filled({ mode: "income", counterId: salary }),
      postings: [
        { account_id: checking, amount: 12000 },
        { account_id: salary, amount: -12000 },
      ],
    },
    {
      name: "transfer moves the amount to the second account",
      state: filled({ mode: "transfer", counterId: savings }),
      postings: [
        { account_id: checking, amount: -12000 },
        { account_id: savings, amount: 12000 },
      ],
    },
  ];

  it.each(cases)("$name", ({ state, postings }) => {
    expect(toTransactionInput(state, currencyOf)).toEqual({
      date: "2026-10-17",
      tags: [],
      postings: postings.map((p) => ({
        account_id: p.account_id,
        amount: { amount: p.amount, currency: "BRL" },
      })),
    });
  });

  it("copies tags and payee_id and keeps a non-empty description", () => {
    const input = toTransactionInput(
      filled({ tags: ["trip"], payeeId: payee, description: "Lunch" }),
      currencyOf,
    );
    expect(input.tags).toEqual(["trip"]);
    expect(input.payee_id).toBe(payee);
    expect(input.description).toBe("Lunch");
  });

  it("omits an empty description and an absent payee", () => {
    const input = toTransactionInput(filled({ description: "  " }), currencyOf);
    expect(input).not.toHaveProperty("description");
    expect(input).not.toHaveProperty("payee_id");
  });

  it("throws on an incomplete state", () => {
    expect(() =>
      toTransactionInput(filled({ amount: null }), currencyOf),
    ).toThrow();
  });
});

describe("canSave", () => {
  it("requires a positive amount, two different accounts and a date", () => {
    expect(canSave(filled({}))).toBe(true);
    expect(canSave(filled({ amount: null }))).toBe(false);
    expect(canSave(filled({ amount: 0 }))).toBe(false);
    expect(canSave(filled({ counterId: "" }))).toBe(false);
    expect(canSave(filled({ accountId: "" }))).toBe(false);
    expect(canSave(filled({ counterId: checking }))).toBe(false);
    expect(canSave(filled({ date: "" }))).toBe(false);
  });
});

describe("formReducer", () => {
  it("clears the counter account when the mode changes", () => {
    const next = formReducer(filled({}), { type: "mode", mode: "income" });
    expect(next.mode).toBe("income");
    expect(next.counterId).toBe("");
    expect(next.amount).toBe(12000);
  });

  it("keeps mode, account and date and clears the rest on next", () => {
    const state = filled({
      mode: "income",
      tags: ["trip"],
      payeeId: payee,
      payeeName: "Mercado",
      description: "Lunch",
    });
    expect(formReducer(state, { type: "next" })).toEqual({
      ...initialForm("2026-10-17", checking),
      mode: "income",
    });
  });

  it("replaces the whole state on restore", () => {
    const restored = filled({ mode: "transfer" });
    expect(
      formReducer(initialForm("2026-10-17"), {
        type: "restore",
        state: restored,
      }),
    ).toBe(restored);
  });

  it("stores a payee by id or by new name", () => {
    const named = formReducer(filled({}), { type: "payee", name: "Feira" });
    expect(named.payeeId).toBeUndefined();
    expect(named.payeeName).toBe("Feira");
    const picked = formReducer(named, { type: "payee", id: payee });
    expect(picked.payeeId).toBe(payee);
    expect(picked.payeeName).toBeUndefined();
  });
});
