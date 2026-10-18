function draftKey(form: string, accountId: string): string {
  return `cards.${form}.${accountId}`;
}

// sessionStorage throws in some private-browsing and blocked-storage configurations; the form works without a draft.
export function loadCardDraft<T>(
  form: string,
  accountId: string,
  valid: (raw: unknown) => raw is T,
): T | null {
  try {
    const raw = sessionStorage.getItem(draftKey(form, accountId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCardDraft(
  form: string,
  accountId: string,
  value: unknown,
): void {
  try {
    sessionStorage.setItem(draftKey(form, accountId), JSON.stringify(value));
  } catch {
    // The draft is a convenience; a failed write loses nothing the form holds.
  }
}

export function clearCardDraft(form: string, accountId: string): void {
  try {
    sessionStorage.removeItem(draftKey(form, accountId));
  } catch {
    // Nothing was stored.
  }
}
