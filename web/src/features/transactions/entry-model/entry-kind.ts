import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];
type TransactionInput = components["schemas"]["TransactionInput"];
type PostingInput = components["schemas"]["PostingInput"];
type Posting = Transaction["postings"][number];

export type PostingKind = "expense" | "income" | "transfer" | "advanced";

// The kinds the server builds from their own fields; the entry flow offers them beside the four
// that post by shape.
export const builtKinds = [
  "trade",
  "fixed_income",
  "investment_income",
  "brokerage_note",
  "foreign_purchase",
  "exchange",
  "corporate_action",
  "custody_transfer",
] as const;
export type BuiltKind = (typeof builtKinds)[number];
export type EntryKind = PostingKind | BuiltKind;

export function isBuiltKind(value: unknown): value is BuiltKind {
  return builtKinds.some((kind) => kind === value);
}

export interface EntryRow {
  accountId: string | null;
  // Minor units, signed as the posting.
  amount: number;
  // The value of amount in the base currency, minor units, positive, when the account holds
  // another currency; the posting's weight takes the sign of amount.
  baseAmount?: number;
  memo: string;
}

export interface EntryDraft {
  kind: PostingKind;
  // Minor units, positive; the kind gives the signs.
  amount: number;
  // The value of amount in the base currency, minor units, positive, when the account holds
  // another currency. Until the owner types it, it follows the stored price.
  baseAmount?: number;
  baseAmountTyped?: boolean;
  date: string;
  accountId: string | null;
  categoryId: string | null;
  toAccountId: string | null;
  payeeId: string | null;
  // A card statement the owner chose for an expense (A136); null leaves it to the date.
  statement: string | null;
  description: string;
  tags: string[];
  rows: EntryRow[];
}

export function emptyDraft(
  date: string,
  accountId: string | null = null,
): EntryDraft {
  return {
    kind: "expense",
    amount: 0,
    date,
    accountId,
    categoryId: null,
    toAccountId: null,
    payeeId: null,
    statement: null,
    description: "",
    tags: [],
    rows: [
      { accountId: null, amount: 0, memo: "" },
      { accountId: null, amount: 0, memo: "" },
    ],
  };
}

function isBalance(account: Account | undefined): boolean {
  return account?.class === "asset" || account?.class === "liability";
}

function isCategory(account: Account | undefined): boolean {
  return account?.class === "income" || account?.class === "expense";
}

// A row counts by its value in the base currency: a transaction balances in that currency (DM1).
export function imbalance(
  rows: readonly EntryRow[],
  accounts: Map<string, Account>,
  base: string,
): number {
  return rows.reduce((sum, row) => sum + rowWeight(row, accounts, base), 0);
}

// An account that holds a currency other than the base: its postings need a weight.
export function isForeign(
  id: string | null,
  accounts: Map<string, Account>,
  base: string,
): boolean {
  return currencyOf(id, accounts, base) !== base;
}

function rowWeight(
  row: EntryRow,
  accounts: Map<string, Account>,
  base: string,
): number {
  if (!isForeign(row.accountId, accounts, base)) return row.amount;

  return Math.sign(row.amount) * (row.baseAmount ?? 0);
}

// The currency of a posting is its account's; a form that names no account yet uses the base.
function currencyOf(
  id: string | null,
  accounts: Map<string, Account>,
  base: string,
): string {
  return (id === null ? undefined : accounts.get(id)?.currency) ?? base;
}

function postingsOf(
  draft: EntryDraft,
  accounts: Map<string, Account>,
  base: string,
): PostingInput[] {
  // amount in the account's currency; value is the same amount in the base currency.
  const posting = (
    id: string | null,
    amount: number,
    value: number,
    memo = "",
  ): PostingInput => ({
    account_id: id ?? "",
    amount: { amount, currency: currencyOf(id, accounts, base) },
    ...(isForeign(id, accounts, base)
      ? { weight: { amount: value, currency: base } }
      : {}),
    ...(memo.trim() === "" ? {} : { memo: memo.trim() }),
  });

  if (draft.kind === "advanced") {
    return draft.rows.map((row) =>
      posting(
        row.accountId,
        row.amount,
        rowWeight(row, accounts, base),
        row.memo,
      ),
    );
  }

  const amount = draft.amount;
  const value = isForeign(draft.accountId, accounts, base)
    ? (draft.baseAmount ?? 0)
    : amount;

  switch (draft.kind) {
    case "expense":
      return [
        {
          ...posting(draft.accountId, -amount, -value),
          ...(draft.statement === null ? {} : { statement: draft.statement }),
        },
        posting(draft.categoryId, value, value),
      ];
    case "income":
      return [
        posting(draft.accountId, amount, value),
        posting(draft.categoryId, -value, -value),
      ];
    case "transfer":
      return [
        posting(draft.accountId, -amount, -value),
        posting(draft.toAccountId, amount, value),
      ];
  }
}

export function inputFromDraft(
  draft: EntryDraft,
  accounts: Map<string, Account>,
  base: string,
): TransactionInput {
  const description = draft.description.trim();
  return {
    date: draft.date,
    ...(description === "" ? {} : { description }),
    ...(draft.payeeId === null || draft.kind === "transfer"
      ? {}
      : { payee_id: draft.payeeId }),
    ...(draft.tags.length === 0 ? {} : { tags: draft.tags }),
    postings: postingsOf(draft, accounts, base),
  };
}

// The three simple shapes are one balance posting against one category, or two balance
// postings; anything else is edited row by row.
export function draftFromTransaction(
  tx: Transaction,
  accounts: Map<string, Account>,
): EntryDraft {
  const base: EntryDraft = {
    ...emptyDraft(tx.date),
    payeeId: tx.payee_id ?? null,
    description: tx.description,
    tags: [...tx.tags],
    rows: tx.postings.map(rowOf),
  };
  const [a, b] = tx.postings;
  const memos = tx.postings.some((p) => (p.memo ?? "") !== "");
  if (tx.postings.length !== 2 || a === undefined || b === undefined || memos) {
    return { ...base, kind: "advanced" };
  }
  const accountA = accounts.get(a.account_id);
  const accountB = accounts.get(b.account_id);
  if (isBalance(accountA) && isCategory(accountB)) {
    return {
      ...base,
      kind: a.amount.amount < 0 ? "expense" : "income",
      amount: Math.abs(a.amount.amount),
      accountId: a.account_id,
      categoryId: b.account_id,
      statement: a.statement ?? null,
      ...recordedValue(a),
    };
  }
  // Two accounts of different currencies are an exchange, which has two amounts.
  const sameCurrency = a.amount.currency === b.amount.currency;
  if (isBalance(accountA) && isBalance(accountB) && sameCurrency) {
    const [from, to] = a.amount.amount < 0 ? [a, b] : [b, a];
    return {
      ...base,
      kind: "transfer",
      amount: Math.abs(a.amount.amount),
      accountId: from.account_id,
      toAccountId: to.account_id,
      ...recordedValue(a),
    };
  }
  return { ...base, kind: "advanced" };
}

function rowOf(p: Posting): EntryRow {
  const baseAmount = valueOf(p);

  return {
    accountId: p.account_id,
    amount: p.amount.amount,
    ...(baseAmount === undefined ? {} : { baseAmount }),
    memo: p.memo ?? "",
  };
}

// The value a posting recorded in the base currency: present when its weight is in another
// currency than its amount.
function valueOf(p: Posting): number | undefined {
  if (p.weight === undefined || p.weight.currency === p.amount.currency) {
    return undefined;
  }

  return Math.abs(p.weight.amount);
}

// The recorded value is kept as typed: a correction never replaces it with today's price.
function recordedValue(p: Posting): Partial<EntryDraft> {
  const baseAmount = valueOf(p);
  if (baseAmount === undefined) return {};

  return { baseAmount, baseAmountTyped: true };
}
