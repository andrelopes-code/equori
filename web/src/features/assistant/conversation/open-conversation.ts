const key = "equori.assistant.conversation";

// The conversation open in the panel, kept for the browser tab's session (P19).
export function readOpenConversation(): string | undefined {
  try {
    return sessionStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeOpenConversation(id: string | undefined): void {
  try {
    if (id === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, id);
  } catch {
    // The panel then opens a new conversation after a reload.
  }
}
