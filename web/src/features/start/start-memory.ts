import { isAccountDraft } from "@/features/accounts";
import type { AccountDraft } from "@/features/accounts";
import { bookKey, bookKeyNames } from "@/features/session";
import type { StartRow } from "@/features/start/start-drafts";
import { pending } from "@/features/start/use-start-run";
import type { GroupRun } from "@/features/start/use-start-run";

export interface StartState {
  step: 0 | 1;
  rows: StartRow[];
  cash: boolean;
  drafts: AccountDraft[];
  runs: GroupRun[];
}

// A191: the walkthrough resumes where it was left. A group whose account is gone, or that failed,
// returns to pending. Storage may refuse access; the walkthrough then opens step 1 empty.
export function readStart(accountIds: readonly string[]): StartState | null {
  const key = bookKey(bookKeyNames.start);
  if (key === null) return null;

  try {
    const raw = localStorage.getItem(key);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (!isStart(value)) return null;

    return {
      ...value,
      runs: value.runs.map((run) =>
        run.state === "created" &&
        run.accountId !== undefined &&
        accountIds.includes(run.accountId)
          ? run
          : pending,
      ),
    };
  } catch {
    return null;
  }
}

// writeStart stores the serialized state; null deletes it (A191.3).
export function writeStart(text: string | null): void {
  const key = bookKey(bookKeyNames.start);
  if (key === null) return;

  try {
    if (text === null) localStorage.removeItem(key);
    else localStorage.setItem(key, text);
  } catch {
    // The walkthrough keeps working; only the resumption is lost.
  }
}

function isStart(value: unknown): value is StartState {
  if (typeof value !== "object" || value === null) return false;

  const state = value as Record<string, unknown>;
  return (
    (state.step === 0 || state.step === 1) &&
    typeof state.cash === "boolean" &&
    Array.isArray(state.rows) &&
    state.rows.every(isRow) &&
    Array.isArray(state.drafts) &&
    state.drafts.every(isAccountDraft) &&
    Array.isArray(state.runs) &&
    state.runs.every(isRun)
  );
}

function isRow(value: unknown): value is StartRow {
  if (typeof value !== "object" || value === null) return false;

  const row = value as Record<string, unknown>;
  return (
    typeof row.key === "string" &&
    (row.institutionId === null || typeof row.institutionId === "string") &&
    typeof row.institutionName === "string" &&
    Array.isArray(row.kinds)
  );
}

function isRun(value: unknown): value is GroupRun {
  if (typeof value !== "object" || value === null) return false;

  const run = value as Record<string, unknown>;
  return (
    typeof run.state === "string" &&
    (run.accountId === undefined || typeof run.accountId === "string") &&
    typeof run.pendingSetup === "boolean"
  );
}
