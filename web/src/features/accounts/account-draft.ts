import type { components } from "@/api/schema.gen";
import type { Kind } from "@/features/accounts/account-kinds";
import type { MessageKey } from "@/i18n/catalog.en";

type Account = components["schemas"]["Account"];

export type Adjustment =
  "none" | "following" | "preceding" | "modified_following";

export interface CardDraft {
  holder: string;
  lastFour: string;
  virtual: boolean;
}

export interface CardSetupDraft {
  closingMode: "day" | "before_due";
  closingDay: number | null;
  closingDaysBeforeDue: number | null;
  dueDay: number | null;
  closingAdjustment: Adjustment;
  dueDateAdjustment: Adjustment;
  assignment: "next" | "closing";
  // Minor units of the account's currency; zero records no limit.
  limit: number;
  cards: CardDraft[];
}

export interface AccountDraft {
  kind: Kind | null;
  name: string;
  institutionId: string | null;
  currency: string;
  openedOn: string;
  parentId: string | null;
  yieldAuto: boolean;
  color: number | null;
  // Minor units, at least zero: what an asset holds or what a liability owes on opening.
  opening: number;
  card: CardSetupDraft;
}

export function emptyCardSetup(): CardSetupDraft {
  return {
    closingMode: "day",
    closingDay: null,
    closingDaysBeforeDue: null,
    dueDay: null,
    closingAdjustment: "none",
    dueDateAdjustment: "following",
    assignment: "next",
    limit: 0,
    cards: [],
  };
}

export function emptyAccountDraft(
  today: string,
  currency: string,
): AccountDraft {
  return {
    kind: null,
    name: "",
    institutionId: null,
    currency,
    openedOn: today,
    parentId: null,
    yieldAuto: false,
    color: null,
    opening: 0,
    card: emptyCardSetup(),
  };
}

const prefix = "equori.accountDraft.";

function isDraft(value: unknown): value is AccountDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    (draft.kind === null || typeof draft.kind === "string") &&
    typeof draft.name === "string" &&
    typeof draft.currency === "string" &&
    typeof draft.openedOn === "string" &&
    typeof draft.opening === "number" &&
    typeof draft.card === "object" &&
    draft.card !== null &&
    Array.isArray((draft.card as Record<string, unknown>).cards)
  );
}

// FM-05: what was typed outlives leaving the form, for the browser tab's session. Storage may
// refuse access; the form then starts empty.
export function readAccountDraft(key: string): AccountDraft | null {
  try {
    const raw = sessionStorage.getItem(prefix + key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return isDraft(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeAccountDraft(key: string, draft: AccountDraft): void {
  try {
    sessionStorage.setItem(prefix + key, JSON.stringify(draft));
  } catch {
    // The form keeps working; only the restore is lost.
  }
}

export function clearAccountDraft(key: string): void {
  try {
    sessionStorage.removeItem(prefix + key);
  } catch {
    // Nothing stored can be read back either.
  }
}

// The fields the account still needs before it is sent, keyed by the request's field names
// (FM-02); a card's rows by their position. A card's billing and plastic cards are set up only
// on create: an edit shows no such fields, and the card's page changes them.
export function draftProblems(
  draft: AccountDraft,
  mode: "create" | "edit",
): Record<string, MessageKey> {
  const problems: Record<string, MessageKey> = {};
  if (draft.kind === null) problems.kind = "accountForm.problem.kind";
  if (draft.name.trim() === "") problems.name = "accountForm.problem.name";
  if (mode === "edit" || draft.kind !== "credit_card") return problems;
  const card = draft.card;
  if (card.closingMode === "day" && card.closingDay === null) {
    problems.closing_day = "accountForm.problem.closingDay";
  }
  if (card.closingMode === "before_due" && card.closingDaysBeforeDue === null) {
    problems.closing_days_before_due = "accountForm.problem.daysBeforeDue";
  }
  if (card.dueDay === null) problems.due_day = "accountForm.problem.dueDay";
  card.cards.forEach((row, i) => {
    if (row.holder.trim() === "") {
      problems[`cards.${String(i)}.holder`] = "accountForm.problem.holder";
    }
    if (!/^\d{4}$/.test(row.lastFour)) {
      problems[`cards.${String(i)}.last_four`] = "accountForm.problem.lastFour";
    }
  });
  return problems;
}

// The draft an edit starts from: what the account holds now.
export function draftFromAccount(account: Account): AccountDraft {
  return {
    kind: account.kind ?? null,
    name: account.name,
    institutionId: account.institution_id ?? null,
    currency: account.currency,
    // The edit form never sends it; an account always has one.
    openedOn: account.opened_on ?? "",
    parentId: account.parent_id ?? null,
    yieldAuto: account.yield_mode === "auto",
    color: account.color ?? null,
    opening: 0,
    card: emptyCardSetup(),
  };
}
