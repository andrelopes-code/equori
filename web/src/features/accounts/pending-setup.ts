import type { AccountDraft } from "@/features/accounts/account-draft";

export interface PendingSetup {
  draft: AccountDraft;
  // How many steps of createAccountSteps(draft) already ran.
  done: number;
}

const prefix = "equori.pendingSetup.";

// The account exists but a step after it failed; the record page offers the remaining steps
// again for the browser tab's session.
export function readPendingSetup(accountId: string): PendingSetup | null {
  try {
    const raw = sessionStorage.getItem(prefix + accountId);
    if (raw === null) return null;
    const value = JSON.parse(raw) as PendingSetup;
    return typeof value.done === "number" ? value : null;
  } catch {
    return null;
  }
}

export function writePendingSetup(
  accountId: string,
  setup: PendingSetup,
): void {
  try {
    sessionStorage.setItem(prefix + accountId, JSON.stringify(setup));
  } catch {
    // The record page then shows nothing to retry; the card setup stays on its own tab.
  }
}

export function clearPendingSetup(accountId: string): void {
  try {
    sessionStorage.removeItem(prefix + accountId);
  } catch {
    // Nothing stored can be read back either.
  }
}
