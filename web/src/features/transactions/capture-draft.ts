import type { components } from "@/api/schema.gen";
import { imbalance, inputFromDraft } from "@/features/transactions/entry-kind";
import type { EntryDraft } from "@/features/transactions/entry-kind";
import type { MessageKey } from "@/i18n/catalog.en";

type Account = components["schemas"]["Account"];
type CaptureLine = components["schemas"]["CaptureLine"];
type CaptureIssue = components["schemas"]["CaptureIssue"];
type CaptureChoice = components["schemas"]["CaptureChoice"];
type BatchEntry = components["schemas"]["TransactionBatchEntry"];
type SuggestionItem = components["schemas"]["CaptureSuggestionItem"];

// What one line records: the form's draft and the installment count of a card purchase,
// zero for one payment.
export interface LineDraft extends EntryDraft {
  installments: number;
}

// What the owner changed on a line: fields set by choosing a reading of an issue, or the
// whole draft as the edit dialog left it, which replaces the reading.
export interface LineOverride {
  chosen?: Partial<LineDraft>;
  edited?: LineDraft;
}

// A line is known by its text and its occurrence among lines of the same text, so editing
// one line drops only its own override (A115).
export function lineKeys(lines: readonly CaptureLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const n = (seen.get(l.text) ?? 0) + 1;
    seen.set(l.text, n);
    return `${String(n)}\n${l.text}`;
  });
}

export function draftOf(line: CaptureLine, override?: LineOverride): LineDraft {
  if (override?.edited !== undefined) return override.edited;
  return {
    kind: line.kind,
    amount: line.amount?.amount ?? 0,
    date: line.date,
    accountId: line.account_id ?? null,
    toAccountId: line.to_account_id ?? null,
    categoryId: line.category_id ?? null,
    payeeId: line.payee_id ?? null,
    statement: null,
    description: line.description,
    tags: line.tags,
    rows: [],
    installments: line.installments ?? 0,
    ...override?.chosen,
  };
}

const settles: Record<CaptureIssue["field"], keyof LineDraft> = {
  amount: "amount",
  date: "date",
  installments: "installments",
  account: "accountId",
  to_account: "toAccountId",
};

// The issues of the reading that no choice settled; an edited line has none.
export function issuesOf(
  line: CaptureLine,
  override?: LineOverride,
): CaptureIssue[] {
  if (override?.edited !== undefined) return [];
  const chosen = override?.chosen ?? {};
  return line.issues.filter((i) => !(settles[i.field] in chosen));
}

export function overrideWithChoice(
  override: LineOverride | undefined,
  issue: CaptureIssue,
  choice: CaptureChoice,
): LineOverride {
  const patch: Partial<LineDraft> = {};
  if (choice.amount !== undefined) patch.amount = choice.amount.amount;
  if (choice.description !== undefined) patch.description = choice.description;
  if (choice.account_id !== undefined) {
    if (issue.field === "to_account") patch.toAccountId = choice.account_id;
    else patch.accountId = choice.account_id;
  }
  return { ...override, chosen: { ...override?.chosen, ...patch } };
}

// What keeps a draft from being recorded, beyond the issues of its reading. A category is
// never required: a line without one records as uncategorized (A113).
export function problemsOf(
  draft: LineDraft,
  accounts: Map<string, Account>,
): MessageKey[] {
  if (draft.kind === "advanced") {
    const complete = draft.rows.every(
      (r) => r.accountId !== null && r.amount !== 0,
    );
    return complete && draft.rows.length >= 2 && imbalance(draft.rows) === 0
      ? []
      : ["capture.problem.rows"];
  }
  const problems: MessageKey[] = [];
  if (draft.amount <= 0) problems.push("capture.problem.amount");
  if (draft.accountId === null) problems.push("capture.problem.account");
  if (draft.kind === "transfer") {
    if (draft.toAccountId === null)
      problems.push("capture.problem.destination");
    else if (draft.toAccountId === draft.accountId)
      problems.push("capture.problem.sameAccount");
  }
  if (draft.installments >= 2) {
    const card =
      draft.accountId === null ? undefined : accounts.get(draft.accountId);
    if (draft.kind !== "expense" || card?.kind !== "credit_card")
      problems.push("capture.problem.installments");
  }
  return problems;
}

function uncategorized(
  accounts: Map<string, Account>,
  role: "uncategorized_expense" | "uncategorized_income",
): string | null {
  for (const a of accounts.values()) if (a.system_role === role) return a.id;
  return null;
}

// The batch entry of a draft without problems (A114).
export function entryOf(
  draft: LineDraft,
  accounts: Map<string, Account>,
  base: string,
): BatchEntry {
  const categoryId =
    draft.categoryId ??
    (draft.kind === "income"
      ? uncategorized(accounts, "uncategorized_income")
      : uncategorized(accounts, "uncategorized_expense"));
  if (draft.installments >= 2 && draft.accountId !== null) {
    const description = draft.description.trim();
    const card = accounts.get(draft.accountId);
    return {
      installment_purchase: {
        card_account_id: draft.accountId,
        date: draft.date,
        ...(description === "" ? {} : { description }),
        ...(draft.payeeId === null ? {} : { payee_id: draft.payeeId }),
        ...(draft.tags.length === 0 ? {} : { tags: draft.tags }),
        splits: [
          {
            account_id: categoryId ?? "",
            amount: { amount: draft.amount, currency: card?.currency ?? base },
          },
        ],
        installment_count: draft.installments,
      },
    };
  }
  return {
    transaction: inputFromDraft({ ...draft, categoryId }, accounts, base),
  };
}

export function pruneOverrides(
  overrides: Readonly<Record<string, LineOverride>>,
  keys: readonly string[],
): Record<string, LineOverride> {
  const keep = new Set(keys);
  return Object.fromEntries(
    Object.entries(overrides).filter(([key]) => keep.has(key)),
  );
}

// The most descriptions one suggestion request carries (ADR 014 L5).
const maxSuggestions = 40;

export function suggestionKey(description: string, kind: string): string {
  return `${kind}\n${description}`;
}

// The drafts a language model is asked about: read as written, expense or income, without an
// issue or a problem, with a description and no category (ADR 014 L1).
export function suggestionItems(
  rows: readonly {
    draft: LineDraft;
    edited: boolean;
    issues: readonly unknown[];
    problems: readonly unknown[];
  }[],
): SuggestionItem[] {
  const seen = new Set<string>();
  const out: SuggestionItem[] = [];
  for (const { draft, edited, issues, problems } of rows) {
    if (draft.kind !== "expense" && draft.kind !== "income") continue;
    const description = draft.description.trim();
    if (
      edited ||
      issues.length > 0 ||
      problems.length > 0 ||
      draft.categoryId !== null ||
      description === ""
    )
      continue;
    const key = suggestionKey(description, draft.kind);
    if (seen.has(key) || out.length === maxSuggestions) continue;
    seen.add(key);
    out.push({ description, kind: draft.kind });
  }
  return out;
}
