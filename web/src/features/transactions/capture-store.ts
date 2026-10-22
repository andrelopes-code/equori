import type {
  LineDraft,
  LineOverride,
} from "@/features/transactions/capture-draft";

// FM-05: the text and the changes made to its lines outlive leaving the page, for the
// browser tab's session; the default account and the entry form last used are preferences
// kept across sessions. Storage may refuse access; the page then starts empty.
const draftKey = "equori.capture.draft";
const defaultAccountKey = "equori.capture.defaultAccount";
const entryFormKey = "equori.entry.form";

export interface CaptureDraft {
  text: string;
  overrides: Record<string, LineOverride>;
}

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isLineDraft(v: unknown): v is LineDraft {
  return (
    record(v) &&
    typeof v.kind === "string" &&
    typeof v.amount === "number" &&
    typeof v.date === "string" &&
    typeof v.description === "string" &&
    typeof v.installments === "number" &&
    Array.isArray(v.tags) &&
    Array.isArray(v.rows)
  );
}

function isOverride(v: unknown): v is LineOverride {
  return (
    record(v) &&
    (v.chosen === undefined || record(v.chosen)) &&
    (v.edited === undefined || isLineDraft(v.edited))
  );
}

export function readCaptureDraft(): CaptureDraft {
  const empty = { text: "", overrides: {} };
  try {
    const raw = sessionStorage.getItem(draftKey);
    if (raw === null) return empty;
    const v: unknown = JSON.parse(raw);
    if (!record(v) || typeof v.text !== "string" || !record(v.overrides))
      return empty;
    const overrides = Object.fromEntries(
      Object.entries(v.overrides).filter((e): e is [string, LineOverride] =>
        isOverride(e[1]),
      ),
    );
    return { text: v.text, overrides };
  } catch {
    return empty;
  }
}

export function writeCaptureDraft(draft: CaptureDraft): void {
  try {
    if (draft.text === "") sessionStorage.removeItem(draftKey);
    else sessionStorage.setItem(draftKey, JSON.stringify(draft));
  } catch {
    // The page keeps working; only the restore is lost.
  }
}

export function readDefaultAccount(): string | null {
  try {
    return localStorage.getItem(defaultAccountKey);
  } catch {
    return null;
  }
}

export function writeDefaultAccount(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(defaultAccountKey);
    else localStorage.setItem(defaultAccountKey, id);
  } catch {
    // The choice holds for this visit only.
  }
}

export type EntryForm = "form" | "text";

// The entry form the owner used last, which N and the dock open (A115).
export function readEntryForm(): EntryForm {
  try {
    return localStorage.getItem(entryFormKey) === "text" ? "text" : "form";
  } catch {
    return "form";
  }
}

export function writeEntryForm(form: EntryForm): void {
  try {
    localStorage.setItem(entryFormKey, form);
  } catch {
    // N keeps opening the form.
  }
}
