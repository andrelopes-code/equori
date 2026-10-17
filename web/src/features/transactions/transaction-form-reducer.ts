import type { components } from "@/api/schema.gen";

export type TransactionInput = components["schemas"]["TransactionInput"];
type PostingInput = components["schemas"]["PostingInput"];

export type Mode = "expense" | "income" | "transfer";

export interface SplitLine {
  key: string;
  categoryId: string;
  amount: number | null;
}

export interface PostingLine {
  key: string;
  accountId: string;
  amount: number | null;
  currency: string;
  memo: string;
}

// Amounts are integers in minor units. counterId is the category for an expense or income and the second account for a transfer.
export interface FormState {
  mode: Mode;
  amount: number | null;
  accountId: string;
  counterId: string;
  date: string;
  payeeId?: string;
  payeeName?: string;
  description: string;
  tags: string[];
  split: SplitLine[] | null;
  postings: PostingLine[] | null;
}

export type FormAction =
  | { type: "mode"; mode: Mode }
  | { type: "amount"; amount: number | null }
  | { type: "account"; id: string }
  | { type: "counter"; id: string }
  | { type: "date"; date: string }
  | { type: "payee"; id?: string; name?: string }
  | { type: "description"; description: string }
  | { type: "tags"; tags: string[] }
  | { type: "next" }
  | { type: "restore"; state: FormState };

export function initialForm(today: string, accountId = ""): FormState {
  return {
    mode: "expense",
    amount: null,
    accountId,
    counterId: "",
    date: today,
    description: "",
    tags: [],
    split: null,
    postings: null,
  };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "mode":
      return { ...state, mode: action.mode, counterId: "" };
    case "amount":
      return { ...state, amount: action.amount };
    case "account":
      return { ...state, accountId: action.id };
    case "counter":
      return { ...state, counterId: action.id };
    case "date":
      return { ...state, date: action.date };
    case "payee": {
      const next = { ...state };
      delete next.payeeId;
      delete next.payeeName;
      if (action.id !== undefined) next.payeeId = action.id;
      else if (action.name !== undefined) next.payeeName = action.name;
      return next;
    }
    case "description":
      return { ...state, description: action.description };
    case "tags":
      return { ...state, tags: action.tags };
    case "next":
      return {
        ...initialForm(state.date, state.accountId),
        mode: state.mode,
      };
    case "restore":
      return action.state;
  }
}

export function canSave(state: FormState): boolean {
  return (
    state.amount !== null &&
    state.amount > 0 &&
    state.accountId !== "" &&
    state.counterId !== "" &&
    state.accountId !== state.counterId &&
    state.date !== ""
  );
}

function posting(
  accountId: string,
  amount: number,
  currencyOf: (accountId: string) => string,
): PostingInput {
  return {
    account_id: accountId,
    amount: { amount, currency: currencyOf(accountId) },
  };
}

// Expense and transfer take the amount from the account; income puts it into the account.
export function toTransactionInput(
  state: FormState,
  currencyOf: (accountId: string) => string,
): TransactionInput {
  if (!canSave(state) || state.amount === null) {
    throw new Error("build transaction input: incomplete form");
  }
  const sign = state.mode === "income" ? 1 : -1;
  const description = state.description.trim();
  return {
    date: state.date,
    ...(description === "" ? {} : { description }),
    ...(state.payeeId === undefined ? {} : { payee_id: state.payeeId }),
    tags: state.tags,
    postings: [
      posting(state.accountId, sign * state.amount, currencyOf),
      posting(state.counterId, -sign * state.amount, currencyOf),
    ],
  };
}
