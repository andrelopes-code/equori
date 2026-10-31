// HA27: the token outlives the login step of an existing member, for the tab's session only.
const key = "equori.invite.token";

export function readInviteToken(): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeInviteToken(token: string): void {
  try {
    sessionStorage.setItem(key, token);
  } catch {
    // A refused storage keeps the token in the address only; nothing else to do.
  }
}

export function forgetInviteToken(): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // A refused storage holds no token to remove.
  }
}
