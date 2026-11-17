import type { components } from "@/api/schema.gen";
import type { EntryDraft } from "@/features/transactions/entry-model/entry-kind";
import {
  imbalance,
  isForeign,
} from "@/features/transactions/entry-model/entry-kind";
import type { MessageKey } from "@/i18n/catalog.en";

type Account = components["schemas"]["Account"];
type Problems = Record<string, MessageKey>;

// What the form can say before any request: the fields a kind needs, keyed as the form names them.
export function draftProblems(
  draft: EntryDraft,
  accounts: Map<string, Account>,
  base: string,
): Problems {
  if (draft.kind === "advanced") return rowProblems(draft, accounts, base);

  const problems: Problems = {};
  if (draft.amount <= 0) problems.amount = "entry.required.amount";

  if (draft.accountId === null) {
    problems.account = "entry.required.account";
  } else if (
    isForeign(draft.accountId, accounts, base) &&
    (draft.baseAmount ?? 0) <= 0
  ) {
    problems.baseAmount = "entry.required.baseAmount";
  }

  if (draft.kind !== "transfer") {
    if (draft.categoryId === null) {
      problems.category = "entry.required.category";
    }

    return problems;
  }

  if (draft.toAccountId === null) {
    problems.to = "entry.required.account";
  } else if (differentCurrencies(draft, accounts)) {
    // An exchange has two amounts; the transfer form holds one.
    delete problems.baseAmount;
    problems.to = "entry.transfer.currencies";
  }

  return problems;
}

function rowProblems(
  draft: EntryDraft,
  accounts: Map<string, Account>,
  base: string,
): Problems {
  const problems: Problems = {};

  draft.rows.forEach((row, index) => {
    const field = `postings[${String(index)}]`;
    if (row.accountId === null) {
      problems[`${field}.account_id`] = "entry.required.account";
    } else if (row.amount === 0) {
      problems[`${field}.amount`] = "entry.required.amount";
    } else if (
      isForeign(row.accountId, accounts, base) &&
      (row.baseAmount ?? 0) <= 0
    ) {
      problems[`${field}.weight`] = "entry.required.baseAmount";
    }
  });

  const valued = !Object.keys(problems).some((key) => key.endsWith(".weight"));
  if (valued && imbalance(draft.rows, accounts, base) !== 0) {
    problems.postings = "entry.required.balance";
  }

  return problems;
}

function differentCurrencies(
  draft: EntryDraft,
  accounts: Map<string, Account>,
): boolean {
  const from = accounts.get(draft.accountId ?? "")?.currency;
  const to = accounts.get(draft.toAccountId ?? "")?.currency;

  return from !== undefined && to !== undefined && from !== to;
}
