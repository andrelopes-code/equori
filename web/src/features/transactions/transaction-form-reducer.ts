import type { components } from "@/api/schema.gen";

export type TransactionInput = components["schemas"]["TransactionInput"];
type PostingInput = components["schemas"]["PostingInput"];

export type Mode = "expense" | "income" | "transfer";

export interface SplitLine {
  key: string;
  categoryId: string;
  amount: number | null;
  // The stored posting this line was loaded from; a correction carries the fields the form does not model.
  stored?: StoredPosting;
}

export interface PostingLine {
  key: string;
  accountId: string;
  amount: number | null;
  currency: string;
  memo: string;
  stored?: StoredPosting;
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
  accountStored?: StoredPosting;
  counterStored?: StoredPosting;
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
  const line = (
    accountId: string,
    amount: number | null,
    stored: StoredPosting | undefined,
  ): PostingLine => ({
    key: "",
    accountId,
    amount,
    currency: currencyOf(accountId),
    memo: stored?.memo ?? "",
    ...(stored === undefined ? {} : { stored }),
  });
  const counters =
    state.split === null
      ? [
          line(
            state.counterId,
            state.amount === null ? null : -sign * state.amount,
            state.counterStored,
          ),
        ]
      : state.split.map((l) =>
          line(
            l.categoryId,
            l.amount === null ? null : -sign * l.amount,
            l.stored,
          ),
        );
  return [
    line(
      state.accountId,
      state.amount === null ? null : sign * state.amount,
      state.accountStored,
    ),
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
          {
            key: "1",
            categoryId: state.counterId,
            amount: null,
            ...(state.counterStored === undefined
              ? {}
              : { stored: state.counterStored }),
          },
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

interface PostingEntry {
  stored?: StoredPosting;
  input: PostingInput;
}

function entry(
  stored: StoredPosting | undefined,
  input: PostingInput,
): PostingEntry {
  return stored === undefined ? { input } : { stored, input };
}

function postingEntries(
  state: FormState,
  currencyOf: (accountId: string) => string,
): PostingEntry[] {
  if (state.postings !== null) {
    return state.postings.flatMap((l) => {
      const memo = l.memo.trim();
      return l.amount === null
        ? []
        : [
            entry(l.stored, {
              account_id: l.accountId,
              amount: { amount: l.amount, currency: l.currency },
              ...(memo === "" ? {} : { memo }),
            }),
          ];
    });
  }
  const total = state.amount ?? 0;
  const sign = accountSign(state);
  const counters =
    state.split === null
      ? [
          entry(
            state.counterStored,
            posting(state.counterId, -sign * total, currencyOf),
          ),
        ]
      : state.split.map((l) =>
          entry(
            l.stored,
            posting(l.categoryId, -sign * (l.amount ?? 0), currencyOf),
          ),
        );
  return [
    entry(
      state.accountStored,
      posting(state.accountId, sign * total, currencyOf),
    ),
    ...counters,
  ];
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
    postings: postingEntries(state, currencyOf).map((e) => e.input),
  };
}

type Transaction = components["schemas"]["Transaction"];
type StoredPosting = Transaction["postings"][number];

type QuickShape = Pick<
  FormState,
  | "mode"
  | "amount"
  | "accountId"
  | "counterId"
  | "accountStored"
  | "counterStored"
>;

// Two postings of one currency that cancel: a balance account and a category of the matching class (expense or income), or two balance accounts (transfer).
function quickShape(
  postings: StoredPosting[],
  classOf: (accountId: string) => string | undefined,
): QuickShape | null {
  const [a, b] = postings;
  if (postings.length !== 2 || a === undefined || b === undefined) return null;
  if (
    a.amount.currency !== b.amount.currency ||
    a.amount.amount !== -b.amount.amount ||
    a.amount.amount === 0
  ) {
    return null;
  }
  const isBalance = (p: StoredPosting) => {
    const c = classOf(p.account_id);
    return c === "asset" || c === "liability";
  };
  const outflow = a.amount.amount < 0 ? a : b;
  const inflow = outflow === a ? b : a;
  if (isBalance(a) && isBalance(b)) {
    return {
      mode: "transfer",
      amount: inflow.amount.amount,
      accountId: outflow.account_id,
      counterId: inflow.account_id,
      accountStored: outflow,
      counterStored: inflow,
    };
  }
  const balance = isBalance(a) ? a : b;
  const category = balance === a ? b : a;
  const mode = balance.amount.amount < 0 ? "expense" : "income";
  if (!isBalance(balance) || classOf(category.account_id) !== mode) return null;
  return {
    mode,
    amount: Math.abs(balance.amount.amount),
    accountId: balance.account_id,
    counterId: category.account_id,
    accountStored: balance,
    counterStored: category,
  };
}

// A stored transaction opens in quick entry when it has the quick shape, otherwise as free postings.
export function fromTransaction(
  tx: Transaction,
  classOf: (accountId: string) => string | undefined,
): FormState {
  const base: FormState = {
    ...initialForm(tx.date),
    ...(tx.payee_id === undefined ? {} : { payeeId: tx.payee_id }),
    description: tx.description,
    tags: tx.tags,
  };
  const quick = quickShape(tx.postings, classOf);
  if (quick !== null) return { ...base, ...quick };
  return {
    ...base,
    postings: tx.postings.map((p, i) => ({
      key: String(i + 1),
      accountId: p.account_id,
      amount: p.amount.amount,
      currency: p.amount.currency,
      memo: p.memo ?? "",
      stored: p,
    })),
  };
}

const carriedKeys = [
  "status",
  "settled_on",
  "original",
  "statement",
  "card_role",
] as const;

// What the form does not model survives a correction while the posting still refers to the same account. The weight is a value in the balancing currency, so it survives only an unchanged amount.
function carriedFields(
  stored: StoredPosting,
  next: PostingInput,
  keepMemo: boolean,
): Partial<PostingInput> {
  if (stored.account_id !== next.account_id) return {};
  const carried: Partial<PostingInput> = {};
  for (const key of carriedKeys) {
    const value = stored[key];
    if (value !== undefined) Object.assign(carried, { [key]: value });
  }
  if (
    stored.amount.amount === next.amount.amount &&
    stored.amount.currency === next.amount.currency
  ) {
    if (stored.weight !== undefined) carried.weight = stored.weight;
  }
  if (keepMemo && stored.memo !== undefined) carried.memo = stored.memo;
  return carried;
}

// The body of a correction: the form's fields over what each line carries from the transaction loaded when the form opened, so nothing the form does not model is dropped and no id has to match a later version.
export function toCorrectionInput(
  state: FormState,
  currencyOf: (accountId: string) => string,
  links: Transaction["links"],
): TransactionInput {
  const input = toTransactionInput(state, currencyOf);
  const keepMemo = state.postings === null;
  return {
    ...input,
    ...(links.length === 0 ? {} : { links }),
    postings: postingEntries(state, currencyOf).map(({ stored, input: p }) =>
      stored === undefined
        ? p
        : { ...carriedFields(stored, p, keepMemo), ...p },
    ),
  };
}
