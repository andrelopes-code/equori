import type { FormState } from "@/features/transactions/transaction-form-reducer";

const draftKey = "equori.draft.transaction-new";
const modes = ["expense", "income", "transfer"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAmount(value: unknown): boolean {
  return value === null || Number.isSafeInteger(value);
}

function isSplitLine(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.categoryId === "string" &&
    isAmount(value.amount)
  );
}

function isPostingLine(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.accountId === "string" &&
    isAmount(value.amount) &&
    typeof value.currency === "string" &&
    typeof value.memo === "string"
  );
}

function isDraft(value: unknown): value is FormState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.mode === "string" &&
    modes.includes(v.mode) &&
    (v.amount === null || typeof v.amount === "number") &&
    typeof v.accountId === "string" &&
    typeof v.counterId === "string" &&
    typeof v.date === "string" &&
    typeof v.description === "string" &&
    Array.isArray(v.tags) &&
    (v.split === null ||
      (Array.isArray(v.split) && v.split.every(isSplitLine))) &&
    (v.postings === null ||
      (Array.isArray(v.postings) && v.postings.every(isPostingLine)))
  );
}

// sessionStorage throws in some private-browsing and blocked-storage configurations; the form works without a draft.
export function loadDraft(): FormState | null {
  try {
    const raw = sessionStorage.getItem(draftKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft(state: FormState): void {
  try {
    sessionStorage.setItem(draftKey, JSON.stringify(state));
  } catch {
    // The draft is a convenience; a failed write loses nothing the form holds.
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(draftKey);
  } catch {
    // Nothing was stored.
  }
}
