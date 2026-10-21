export { majorFromMinor, minorFromMajor } from "@/ui/money-units";

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
