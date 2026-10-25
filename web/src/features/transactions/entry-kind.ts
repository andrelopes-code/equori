import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];
type TransactionInput = components["schemas"]["TransactionInput"];
type PostingInput = components["schemas"]["PostingInput"];

export type PostingKind = "expense" | "income" | "transfer" | "advanced";

// The kinds the server builds from their own fields; the entry flow offers them beside the four
// that post by shape.
export const builtKinds = [
  "trade",
  "investment_income",
  "foreign_purchase",
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
  memo: string;
}

export interface EntryDraft {
  kind: PostingKind;
  // Minor units, positive; the kind gives the signs.
  amount: number;
  date: string;
  accountId: string | null;
  categoryId: string | null;
  toAccountId: string | null;
  payeeId: string | null;
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

export function imbalance(rows: readonly EntryRow[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
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
  const posting = (
    id: string | null,
    amount: number,
    memo = "",
  ): PostingInput => ({
    account_id: id ?? "",
    amount: { amount, currency: currencyOf(id, accounts, base) },
    ...(memo.trim() === "" ? {} : { memo: memo.trim() }),
  });
  switch (draft.kind) {
    case "expense":
      return [
        posting(draft.accountId, -draft.amount),
        posting(draft.categoryId, draft.amount),
      ];
    case "income":
      return [
        posting(draft.accountId, draft.amount),
        posting(draft.categoryId, -draft.amount),
      ];
    case "transfer":
      return [
        posting(draft.accountId, -draft.amount),
        posting(draft.toAccountId, draft.amount),
      ];
    case "advanced":
      return draft.rows.map((row) =>
        posting(row.accountId, row.amount, row.memo),
      );
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
    rows: tx.postings.map((p) => ({
      accountId: p.account_id,
      amount: p.amount.amount,
      memo: p.memo ?? "",
    })),
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
    };
  }
  if (isBalance(accountA) && isBalance(accountB)) {
    const [from, to] = a.amount.amount < 0 ? [a, b] : [b, a];
    return {
      ...base,
      kind: "transfer",
      amount: Math.abs(a.amount.amount),
      accountId: from.account_id,
      toAccountId: to.account_id,
    };
  }
  return { ...base, kind: "advanced" };
}
