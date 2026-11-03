import { emptyAccountDraft } from "@/features/accounts";
import type { AccountDraft, PendingInstitution } from "@/features/accounts";

export type StartKind = "checking" | "savings" | "credit_card";

export const startKinds: readonly StartKind[] = [
  "checking",
  "savings",
  "credit_card",
];

export interface StartRow {
  key: string;
  institutionId: string | null;
  // The institution chosen and not yet created; institutionId is null then.
  pendingInstitution: PendingInstitution | null;
  institutionName: string;
  kinds: readonly StartKind[];
}

interface StartContext {
  today: string;
  currency: string;
  kindLabel: (kind: StartKind | "cash") => string;
  cashName: string;
}

// A row without an institution is ignored: a new row starts empty.
export function canContinue(rows: readonly StartRow[], cash: boolean): boolean {
  const chosen = rows.filter(isChosen);
  if (chosen.some((row) => row.kinds.length === 0)) return false;
  return cash || chosen.length > 0;
}

export function startDrafts(
  rows: readonly StartRow[],
  cash: boolean,
  ctx: StartContext,
): AccountDraft[] {
  const drafts = rows.filter(isChosen).flatMap((row) =>
    startKinds
      .filter((kind) => row.kinds.includes(kind))
      .map((kind) => ({
        ...emptyAccountDraft(ctx.today, ctx.currency),
        kind,
        name: `${row.institutionName} ${ctx.kindLabel(kind)}`,
        institutionId: row.institutionId,
        pendingInstitution: row.pendingInstitution,
      })),
  );
  if (!cash) return drafts;

  return [
    ...drafts,
    {
      ...emptyAccountDraft(ctx.today, ctx.currency),
      kind: "cash",
      name: ctx.cashName,
    },
  ];
}

function isChosen(row: StartRow): boolean {
  return row.institutionId !== null || row.pendingInstitution !== null;
}
