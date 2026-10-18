import { describe, expect, it } from "vitest";

import {
  canSave,
  formReducer,
  fromTransaction,
  initialForm,
  postingImbalance,
  splitRemainder,
  toTransactionInput,
} from "@/features/transactions/transaction-form-reducer";
import type { components } from "@/api/schema.gen";
import type {
  FormState,
  PostingLine,
} from "@/features/transactions/transaction-form-reducer";

const checking = "11111111-1111-4111-8111-111111111111";
const food = "22222222-2222-4222-8222-222222222222";
const salary = "33333333-3333-4333-8333-333333333333";
const savings = "44444444-4444-4444-8444-444444444444";
const payee = "55555555-5555-4555-8555-555555555555";
const fun = "66666666-6666-4666-8666-666666666666";

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

function split(amounts: (number | null)[]): FormState {
  return filled({
    amount: 10000,
    split: amounts.map((amount, i) => ({
      key: String(i + 1),
      categoryId: i === 0 ? food : fun,
      amount,
    })),
  });
}

function line(
  key: string,
  accountId: string,
  amount: number | null,
  currency = "BRL",
  memo = "",
): PostingLine {
  return { key, accountId, amount, currency, memo };
}

describe("splitRemainder", () => {
  it("is the total minus the lines, counting an empty line as zero", () => {
    expect(splitRemainder(split([6000, 2500]))).toBe(1500);
    expect(splitRemainder(split([6000, 2500, 1500]))).toBe(0);
    expect(splitRemainder(split([6000, null]))).toBe(4000);
    expect(splitRemainder(split([6000, 5000]))).toBe(-1000);
    expect(splitRemainder(filled({ amount: null, split: [] }))).toBe(0);
  });
});

describe("postingImbalance", () => {
  const cases: { name: string; lines: PostingLine[]; want: object }[] = [
    {
      name: "balanced single currency",
      lines: [line("1", checking, -100), line("2", food, 100)],
      want: {},
    },
    {
      name: "unbalanced single currency",
      lines: [line("1", checking, -100), line("2", food, 90)],
      want: { BRL: -10 },
    },
    {
      name: "balanced per currency",
      lines: [
        line("1", checking, -100),
        line("2", food, 100),
        line("3", savings, -5, "USD"),
        line("4", salary, 5, "USD"),
      ],
      want: {},
    },
    {
      name: "empty amounts count as zero",
      lines: [line("1", checking, -100), line("2", food, null)],
      want: { BRL: -100 },
    },
  ];
  it.each(cases)("$name", ({ lines, want }) => {
    expect(postingImbalance(lines)).toEqual(want);
  });
});

describe("split mode", () => {
  it("starts with two lines, the first holding the chosen category", () => {
    const next = formReducer(filled({ amount: 10000 }), { type: "split" });
    expect(next.split).toEqual([
      { key: "1", categoryId: food, amount: null },
      { key: "2", categoryId: "", amount: null },
    ]);
    expect(splitRemainder(next)).toBe(10000);
  });

  it("adds, edits and removes lines and tracks the remainder", () => {
    let state = split([6000, 2500]);
    expect(splitRemainder(state)).toBe(1500);
    state = formReducer(state, { type: "splitAdd" });
    expect(state.split?.map((l) => l.key)).toEqual(["1", "2", "3"]);
    state = formReducer(state, { type: "splitAmount", key: "3", amount: 1500 });
    state = formReducer(state, {
      type: "splitCategory",
      key: "3",
      id: salary,
    });
    expect(splitRemainder(state)).toBe(0);
    expect(state.split?.[2]?.categoryId).toBe(salary);
    state = formReducer(state, { type: "splitRemove", key: "3" });
    expect(splitRemainder(state)).toBe(1500);
  });

  it("leaves split mode on quick", () => {
    expect(formReducer(split([1, 2]), { type: "quick" }).split).toBeNull();
  });

  it("builds one account posting and one posting per category line", () => {
    const state = split([6000, 2500, 1500]);
    const full = formReducer(state, {
      type: "splitCategory",
      key: "3",
      id: salary,
    });
    expect(toTransactionInput(full, currencyOf).postings).toEqual([
      { account_id: checking, amount: { amount: -10000, currency: "BRL" } },
      { account_id: food, amount: { amount: 6000, currency: "BRL" } },
      { account_id: fun, amount: { amount: 2500, currency: "BRL" } },
      { account_id: salary, amount: { amount: 1500, currency: "BRL" } },
    ]);
  });

  it("income splits credit the account", () => {
    const state = { ...split([6000, 4000]), mode: "income" as const };
    expect(
      toTransactionInput(state, currencyOf).postings.map(
        (p) => p.amount.amount,
      ),
    ).toEqual([10000, -6000, -4000]);
  });

  it("saves only when the remainder is zero and every line is complete", () => {
    expect(canSave(split([6000, 4000]))).toBe(true);
    expect(canSave(split([6000, 2500]))).toBe(false);
    expect(canSave(split([6000, 5000]))).toBe(false);
    expect(canSave(split([10000, null]))).toBe(false);
    expect(canSave(split([10000, 0]))).toBe(false);
    expect(
      canSave({
        ...split([6000, 4000]),
        split: [
          { key: "1", categoryId: food, amount: 6000 },
          { key: "2", categoryId: "", amount: 4000 },
        ],
      }),
    ).toBe(false);
  });

  it("drops the split when the mode becomes transfer and clears its categories otherwise", () => {
    expect(
      formReducer(split([6000, 4000]), { type: "mode", mode: "transfer" })
        .split,
    ).toBeNull();
    const income = formReducer(split([6000, 4000]), {
      type: "mode",
      mode: "income",
    });
    expect(income.split?.map((l) => l.categoryId)).toEqual(["", ""]);
    expect(income.split?.map((l) => l.amount)).toEqual([6000, 4000]);
  });
});

describe("advanced mode", () => {
  const brl = (id: string) => (id === savings ? "USD" : "BRL");

  it("prefills the postings from the quick entry", () => {
    const next = formReducer(filled({ amount: 12000 }), {
      type: "advanced",
      currencyOf: brl,
    });
    expect(next.postings).toEqual([
      {
        key: "1",
        accountId: checking,
        amount: -12000,
        currency: "BRL",
        memo: "",
      },
      { key: "2", accountId: food, amount: 12000, currency: "BRL", memo: "" },
    ]);
  });

  it("prefills the postings from a split", () => {
    const next = formReducer(split([6000, 4000]), {
      type: "advanced",
      currencyOf: brl,
    });
    expect(next.postings?.map((p) => [p.accountId, p.amount])).toEqual([
      [checking, -10000],
      [food, 6000],
      [fun, 4000],
    ]);
  });

  it("prefills empty amounts as null", () => {
    const next = formReducer(initialForm("2026-10-17", checking), {
      type: "advanced",
      currencyOf: brl,
    });
    expect(next.postings?.map((p) => [p.accountId, p.amount])).toEqual([
      [checking, null],
      ["", null],
    ]);
  });

  it("adds, edits and removes postings", () => {
    let state = formReducer(filled({}), { type: "advanced", currencyOf: brl });
    state = formReducer(state, { type: "postingAdd", currency: "BRL" });
    expect(state.postings?.map((p) => p.key)).toEqual(["1", "2", "3"]);
    state = formReducer(state, {
      type: "postingAccount",
      key: "3",
      id: savings,
      currency: "USD",
      scale: () => 2,
    });
    state = formReducer(state, { type: "postingAmount", key: "3", amount: 5 });
    state = formReducer(state, { type: "postingMemo", key: "3", memo: "fx" });
    expect(state.postings?.[2]).toEqual({
      key: "3",
      accountId: savings,
      amount: 5,
      currency: "USD",
      memo: "fx",
    });
    state = formReducer(state, { type: "postingRemove", key: "3" });
    expect(state.postings).toHaveLength(2);
  });

  it("saves only when every currency balances", () => {
    const base = filled({});
    const balanced = formReducer(base, { type: "advanced", currencyOf: brl });
    expect(canSave(balanced)).toBe(true);
    const off = formReducer(balanced, {
      type: "postingAmount",
      key: "2",
      amount: 11000,
    });
    expect(canSave(off)).toBe(false);
    const noAccount = formReducer(balanced, {
      type: "postingAccount",
      key: "2",
      id: "",
      currency: "BRL",
      scale: () => 2,
    });
    expect(canSave(noAccount)).toBe(false);
    expect(canSave({ ...balanced, date: "" })).toBe(false);
  });

  it("sends the postings with a memo only when filled", () => {
    let state = formReducer(filled({}), { type: "advanced", currencyOf: brl });
    state = formReducer(state, {
      type: "postingMemo",
      key: "2",
      memo: " rent ",
    });
    expect(toTransactionInput(state, brl).postings).toEqual([
      { account_id: checking, amount: { amount: -12000, currency: "BRL" } },
      {
        account_id: food,
        amount: { amount: 12000, currency: "BRL" },
        memo: "rent",
      },
    ]);
  });

  it("returns to the quick entry on quick", () => {
    const state = formReducer(filled({}), {
      type: "advanced",
      currencyOf: brl,
    });
    expect(formReducer(state, { type: "quick" }).postings).toBeNull();
  });

  it("keeps the typed name next to the id of a payee that was stored", () => {
    const named = formReducer(filled({}), { type: "payee", name: "Feira" });
    const stored = formReducer(named, { type: "payeeCreated", id: payee });
    expect(stored.payeeId).toBe(payee);
    expect(stored.payeeName).toBe("Feira");
  });

  it("clears the amount when the new account's currency has another scale", () => {
    const scale = (code: string) => (code === "JPY" ? 0 : 2);
    const state = formReducer(filled({}), {
      type: "advanced",
      currencyOf: brl,
    });
    const jpy = formReducer(state, {
      type: "postingAccount",
      key: "2",
      id: savings,
      currency: "JPY",
      scale,
    });
    expect(jpy.postings?.[1]).toEqual({
      key: "2",
      accountId: savings,
      amount: null,
      currency: "JPY",
      memo: "",
    });
    const usd = formReducer(state, {
      type: "postingAccount",
      key: "2",
      id: savings,
      currency: "USD",
      scale,
    });
    expect(usd.postings?.[1]?.amount).toBe(12000);
    expect(usd.postings?.[1]?.currency).toBe("USD");
  });
});

describe("fromTransaction", () => {
  const brl = (amount: number) => ({ amount, currency: "BRL" });
  const stored: components["schemas"]["Transaction"] = {
    id: "t-1",
    date: "2026-10-10",
    description: "Weekly shop",
    balancing_currency: "BRL",
    origin: "manual",
    version: 3,
    tags: [],
    links: [],
    postings: [
      {
        id: "p1",
        account_id: checking,
        amount: brl(-12000),
        weight: brl(-12000),
        status: "cleared",
      },
      {
        id: "p2",
        account_id: food,
        amount: brl(12000),
        weight: brl(12000),
        status: "pending",
        memo: "bread",
      },
    ],
  };
  const classOf = (id: string) => (id === checking ? "asset" : "expense");

  it("keeps the stored posting memo when quick entry turns advanced", () => {
    const quick = fromTransaction(stored, classOf);
    expect(quick.postings).toBeNull();
    const advanced = formReducer(quick, { type: "advanced", currencyOf });
    expect(advanced.postings?.map((l) => l.memo)).toEqual(["", "bread"]);
  });
});
