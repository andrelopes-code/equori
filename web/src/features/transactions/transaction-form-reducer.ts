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
  | { type: "payeeCreated"; id: string }
  | { type: "description"; description: string }
  | { type: "tags"; tags: string[] }
  | { type: "split" }
  | { type: "splitAdd" }
  | { type: "splitCategory"; key: string; id: string }
  | { type: "splitAmount"; key: string; amount: number | null }
  | { type: "splitRemove"; key: string }
  | { type: "advanced"; currencyOf: (accountId: string) => string }
  | { type: "postingAdd"; currency: string }
  | {
      type: "postingAccount";
      key: string;
      id: string;
      currency: string;
      scale: (code: string) => number;
    }
  | { type: "postingAmount"; key: string; amount: number | null }
  | { type: "postingMemo"; key: string; memo: string }
  | { type: "postingRemove"; key: string }
  | { type: "quick" }
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

// A new key is one above the highest in use, which keeps the reducer pure and deterministic.
function nextKey(lines: { key: string }[]): string {
  return String(Math.max(0, ...lines.map((l) => Number(l.key))) + 1);
}

function mapLine<T extends { key: string }>(
  lines: T[] | null,
  key: string,
  change: Partial<T>,
): T[] | null {
  return (
    lines?.map((line) => (line.key === key ? { ...line, ...change } : line)) ??
    null
  );
}

// Amounts are integers in minor units; an empty amount counts as zero.
export function splitRemainder(state: FormState): number {
  const total = state.amount ?? 0;
  return (state.split ?? []).reduce((rest, l) => rest - (l.amount ?? 0), total);
}

// Sum per currency, only the currencies that do not net to zero.
export function postingImbalance(lines: PostingLine[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const l of lines) {
    sums[l.currency] = (sums[l.currency] ?? 0) + (l.amount ?? 0);
  }
  return Object.fromEntries(
    Object.entries(sums).filter(([, sum]) => sum !== 0),
  );
}

// The account side takes the amount for an expense or transfer and gives it for an income.
function accountSign(state: FormState): 1 | -1 {
  return state.mode === "income" ? 1 : -1;
}

function quickPostings(
  state: FormState,
  currencyOf: (accountId: string) => string,
): PostingLine[] {
  const sign = accountSign(state);
  const line = (accountId: string, amount: number | null): PostingLine => ({
    key: "",
    accountId,
    amount,
    currency: currencyOf(accountId),
    memo: "",
  });
  const counters =
    state.split === null
      ? [
          line(
            state.counterId,
            state.amount === null ? null : -sign * state.amount,
          ),
        ]
      : state.split.map((l) =>
          line(l.categoryId, l.amount === null ? null : -sign * l.amount),
        );
  return [
    line(state.accountId, state.amount === null ? null : sign * state.amount),
    ...counters,
  ].map((l, i) => ({ ...l, key: String(i + 1) }));
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "mode":
      return {
        ...state,
        mode: action.mode,
        counterId: "",
        split:
          state.split === null || action.mode === "transfer"
            ? null
            : state.split.map((l) => ({ ...l, categoryId: "" })),
      };
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
    case "payeeCreated":
      return { ...state, payeeId: action.id };
    case "description":
      return { ...state, description: action.description };
    case "tags":
      return { ...state, tags: action.tags };
    case "split":
      return {
        ...state,
        split: [
          { key: "1", categoryId: state.counterId, amount: null },
          { key: "2", categoryId: "", amount: null },
        ],
      };
    case "splitAdd":
      return {
        ...state,
        split: [
          ...(state.split ?? []),
          { key: nextKey(state.split ?? []), categoryId: "", amount: null },
        ],
      };
    case "splitCategory":
      return {
        ...state,
        split: mapLine(state.split, action.key, { categoryId: action.id }),
      };
    case "splitAmount":
      return {
        ...state,
        split: mapLine(state.split, action.key, { amount: action.amount }),
      };
    case "splitRemove":
      return {
        ...state,
        split: state.split?.filter((l) => l.key !== action.key) ?? null,
      };
    case "advanced":
      return { ...state, postings: quickPostings(state, action.currencyOf) };
    case "postingAdd":
      return {
        ...state,
        postings: [
          ...(state.postings ?? []),
          {
            key: nextKey(state.postings ?? []),
            accountId: "",
            amount: null,
            currency: action.currency,
            memo: "",
          },
        ],
      };
    case "postingAccount": {
      const previous = state.postings?.find((l) => l.key === action.key);
      // A minor-unit integer is only meaningful at the scale it was typed in.
      const rescaled =
        previous !== undefined &&
        action.scale(previous.currency) !== action.scale(action.currency);
      return {
        ...state,
        postings: mapLine(state.postings, action.key, {
          accountId: action.id,
          currency: action.currency,
          ...(rescaled ? { amount: null } : {}),
        }),
      };
    }
    case "postingAmount":
      return {
        ...state,
        postings: mapLine(state.postings, action.key, {
          amount: action.amount,
        }),
      };
    case "postingMemo":
      return {
        ...state,
        postings: mapLine(state.postings, action.key, { memo: action.memo }),
      };
    case "postingRemove":
      return {
        ...state,
        postings: state.postings?.filter((l) => l.key !== action.key) ?? null,
      };
    case "quick":
      return { ...state, split: null, postings: null };
    case "next":
      return {
        ...initialForm(state.date, state.accountId),
        mode: state.mode,
      };
    case "restore":
      return action.state;
  }
}

function canSaveQuick(state: FormState): boolean {
  return (
    state.amount !== null &&
    state.amount > 0 &&
    state.accountId !== "" &&
    state.date !== "" &&
    (state.split === null
      ? state.counterId !== "" && state.accountId !== state.counterId
      : state.split.length > 0 &&
        splitRemainder(state) === 0 &&
        state.split.every(
          (l) => l.categoryId !== "" && l.amount !== null && l.amount > 0,
        ))
  );
}

function canSavePostings(lines: PostingLine[], date: string): boolean {
  return (
    date !== "" &&
    lines.length >= 2 &&
    lines.every(
      (l) => l.accountId !== "" && l.amount !== null && l.amount !== 0,
    ) &&
    Object.keys(postingImbalance(lines)).length === 0
  );
}

export function canSave(state: FormState): boolean {
  return state.postings === null
    ? canSaveQuick(state)
    : canSavePostings(state.postings, state.date);
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

function postingInputs(
  state: FormState,
  currencyOf: (accountId: string) => string,
): PostingInput[] {
  if (state.postings !== null) {
    return state.postings.flatMap((l) => {
      const memo = l.memo.trim();
      return l.amount === null
        ? []
        : [
            {
              account_id: l.accountId,
              amount: { amount: l.amount, currency: l.currency },
              ...(memo === "" ? {} : { memo }),
            },
          ];
    });
  }
  const total = state.amount ?? 0;
  const sign = accountSign(state);
  const counters =
    state.split === null
      ? [posting(state.counterId, -sign * total, currencyOf)]
      : state.split.map((l) =>
          posting(l.categoryId, -sign * (l.amount ?? 0), currencyOf),
        );
  return [posting(state.accountId, sign * total, currencyOf), ...counters];
}

export function toTransactionInput(
  state: FormState,
  currencyOf: (accountId: string) => string,
): TransactionInput {
  if (!canSave(state)) {
    throw new Error("build transaction input: incomplete form");
  }
  const description = state.description.trim();
  return {
    date: state.date,
    ...(description === "" ? {} : { description }),
    ...(state.payeeId === undefined ? {} : { payee_id: state.payeeId }),
    tags: state.tags,
    postings: postingInputs(state, currencyOf),
  };
}
