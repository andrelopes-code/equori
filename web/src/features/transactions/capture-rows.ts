import type { components } from "@/api/schema.gen";
import {
  draftOf,
  issuesOf,
  problemsOf,
  suggestionKey,
} from "@/features/transactions/capture-draft";
import type {
  LineDraft,
  LineOverride,
} from "@/features/transactions/capture-draft";
import type { MessageKey } from "@/i18n/catalog.en";

type Account = components["schemas"]["Account"];
type CaptureLine = components["schemas"]["CaptureLine"];
type CaptureIssue = components["schemas"]["CaptureIssue"];

// One line of the text as read, with the owner's changes applied.
export interface ReadRow {
  key: string;
  line: CaptureLine;
  draft: LineDraft;
  issues: CaptureIssue[];
  edited: boolean;
  problems: MessageKey[];
}

// A read row with the category a language model suggested, when one was taken.
export interface CaptureRow extends ReadRow {
  suggested: boolean;
}

export function readRows(
  lines: readonly CaptureLine[],
  keys: readonly string[],
  overrides: Readonly<Record<string, LineOverride>>,
  accountsById: Map<string, Account>,
): ReadRow[] {
  return lines.map((line, i) => {
    const override = overrides[keys[i] ?? ""];
    const draft = draftOf(line, override);
    const issues = issuesOf(line, override);

    return {
      key: keys[i] ?? String(i),
      line,
      draft,
      issues,
      edited: override?.edited !== undefined,
      problems: issues.length > 0 ? [] : problemsOf(draft, accountsById),
    };
  });
}

// A suggestion fills only a category the reading left empty, on a line the owner did not edit.
export function suggestedRows(
  read: readonly ReadRow[],
  suggestions: readonly {
    description: string;
    kind: string;
    categoryId: string | null;
  }[],
): CaptureRow[] {
  const suggested = new Map(
    suggestions.map((s) => [
      suggestionKey(s.description, s.kind),
      s.categoryId,
    ]),
  );

  return read.map((r) => {
    const categoryId =
      r.edited || r.draft.categoryId !== null
        ? null
        : (suggested.get(
            suggestionKey(r.draft.description.trim(), r.draft.kind),
          ) ?? null);

    return categoryId === null
      ? { ...r, suggested: false }
      : { ...r, draft: { ...r.draft, categoryId }, suggested: true };
  });
}

// The rows that keep the batch from being recorded.
export function attentionCount(rows: readonly ReadRow[]): number {
  return rows.filter((r) => r.issues.length > 0 || r.problems.length > 0)
    .length;
}
