import type { MoneyParts, MoneySegment } from "@/i18n/format";

// A fixed length: the digit count of an amount is information.
export const MASK = "••••";

// The sign is dropped as well: whether money came in or went out is information too.
export function maskParts(parts: MoneyParts): MoneyParts {
  return { sign: "", symbol: parts.symbol, integer: MASK, fraction: "" };
}

export function maskText(parts: MoneyParts): string {
  return `${parts.symbol} ${MASK}`;
}

// The same masking as maskParts, for an amount drawn in the order of the locale's pattern.
export function maskSegments(segments: MoneySegment[]): MoneySegment[] {
  return segments.flatMap((segment): MoneySegment[] => {
    if (segment.kind === "sign" || segment.kind === "fraction") return [];
    if (segment.kind === "integer") return [{ kind: "integer", text: MASK }];
    return [segment];
  });
}
