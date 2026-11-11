export const minPassphraseLength = 8;
export const maxPassphraseLength = 256;

export type PassphraseProblem = "tooShort" | "unsaved" | "mismatch";

interface PassphraseDraft {
  passphrase: string;
  confirmation: string;
  // The passphrase is the one the dialog generated and the owner did not edit.
  proposed: boolean;
  saved: boolean;
}

// What stops an export with credentials: the length of C1, then the saved checkbox of the proposed
// passphrase or the second entry of a typed one (export design C1, T9).
export function passphraseProblem(
  draft: PassphraseDraft,
): PassphraseProblem | null {
  const length = Array.from(draft.passphrase).length;
  if (length < minPassphraseLength || length > maxPassphraseLength) {
    return "tooShort";
  }
  if (draft.proposed) {
    return draft.saved ? null : "unsaved";
  }
  return draft.passphrase === draft.confirmation ? null : "mismatch";
}
