import type { EntryDraft } from "@/features/transactions/entry-kind";

export type MovedField =
  | "kind"
  | "amount"
  | "date"
  | "account"
  | "category"
  | "to"
  | "payee"
  | "description"
  | "tags"
  | "postings";

const simple: [MovedField, (d: EntryDraft) => unknown][] = [
  ["kind", (d) => d.kind],
  ["amount", (d) => d.amount],
  ["date", (d) => d.date],
  ["account", (d) => d.accountId],
  ["category", (d) => d.categoryId],
  ["to", (d) => d.toAccountId],
  ["payee", (d) => d.payeeId],
  ["description", (d) => d.description],
  ["tags", (d) => d.tags.join("\u0000")],
];

// FM-08: what another writer changed between the read the form opened on and the read after
// a stale-version refusal.
export function movedFields(
  opened: EntryDraft,
  stored: EntryDraft,
): MovedField[] {
  if (opened.kind === "advanced" || stored.kind === "advanced") {
    const rows = (d: EntryDraft) => JSON.stringify(d.rows);
    const rest = simple.filter(
      ([field]) =>
        !["kind", "amount", "account", "category", "to"].includes(field),
    );
    return [
      ...rest
        .filter(([, read]) => read(opened) !== read(stored))
        .map(([f]) => f),
      ...(rows(opened) === rows(stored) ? [] : (["postings"] as const)),
    ];
  }
  return simple
    .filter(([, read]) => read(opened) !== read(stored))
    .map(([field]) => field);
}
