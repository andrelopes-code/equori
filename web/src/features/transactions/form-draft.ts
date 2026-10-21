import type { EntryDraft } from "@/features/transactions/entry-kind";

const prefix = "equori.draft.";
const kinds = new Set(["expense", "income", "transfer", "advanced"]);

function isDraft(value: unknown): value is EntryDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.kind === "string" &&
    kinds.has(draft.kind) &&
    typeof draft.amount === "number" &&
    typeof draft.date === "string" &&
    typeof draft.description === "string" &&
    Array.isArray(draft.tags) &&
    Array.isArray(draft.rows)
  );
}

// FM-05: what was typed outlives leaving the form, for the browser tab's session. Storage may
// refuse access; the form then starts empty.
export function readDraft(key: string): EntryDraft | null {
  try {
    const raw = sessionStorage.getItem(prefix + key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return isDraft(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: EntryDraft): void {
  try {
    sessionStorage.setItem(prefix + key, JSON.stringify(draft));
  } catch {
    // The form keeps working; only the restore is lost.
  }
}

export function clearDraft(key: string): void {
  try {
    sessionStorage.removeItem(prefix + key);
  } catch {
    // Nothing stored can be read back either.
  }
}
