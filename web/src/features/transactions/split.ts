// Workaround for Slotted finding "currency-field holds the amount as a float in major units":
// the field's number is read through its decimal text so no float reaches the API (O7).
export function minorFromMajor(major: number, scale: number): number {
  const [whole = "0", fraction = ""] = Math.abs(major)
    .toFixed(scale)
    .split(".");
  const minor = Number(whole + fraction.padEnd(scale, "0"));
  return major < 0 ? -minor : minor;
}

export function majorFromMinor(minor: number, scale: number): number {
  if (scale === 0) return minor;
  const digits = String(Math.abs(minor)).padStart(scale + 1, "0");
  const text = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return minor < 0 ? -Number(text) : Number(text);
}

export interface SplitPart {
  categoryId: string | null;
  // Minor units, signed as the category posting.
  amount: number;
}

export function splitState(
  total: number,
  parts: readonly SplitPart[],
): { remaining: number; ready: boolean } {
  const remaining = total - parts.reduce((sum, p) => sum + p.amount, 0);
  const ids = parts.map((p) => p.categoryId);
  const ready =
    remaining === 0 &&
    parts.length > 0 &&
    parts.every((p) => p.categoryId !== null && p.amount !== 0) &&
    new Set(ids).size === ids.length;
  return { remaining, ready };
}
