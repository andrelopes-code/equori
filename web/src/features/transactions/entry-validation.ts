import type { EntryDraft } from "@/features/transactions/entry-kind";
import { imbalance } from "@/features/transactions/entry-kind";
import type { MessageKey } from "@/i18n/catalog.en";

// What the form can say before any request: the fields a kind needs, keyed as the form names them.
export function draftProblems(draft: EntryDraft): Record<string, MessageKey> {
  const problems: Record<string, MessageKey> = {};
  if (draft.kind === "advanced") {
    draft.rows.forEach((row, index) => {
      if (row.accountId === null) {
        problems[`postings[${String(index)}].account_id`] =
          "entry.required.account";
      } else if (row.amount === 0) {
        problems[`postings[${String(index)}].amount`] = "entry.required.amount";
      }
    });
    if (imbalance(draft.rows) !== 0)
      problems.postings = "entry.required.balance";
    return problems;
  }
  if (draft.amount <= 0) problems.amount = "entry.required.amount";
  if (draft.accountId === null) problems.account = "entry.required.account";
  if (draft.kind === "transfer") {
    if (draft.toAccountId === null) problems.to = "entry.required.account";
  } else if (draft.categoryId === null) {
    problems.category = "entry.required.category";
  }
  return problems;
}
