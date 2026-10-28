import { numberFormatter } from "@/i18n/format";

// A percent travels as basis points, an integer (10000 is 100%). Text and integer convert by
// string manipulation, never by floating-point arithmetic.
const percent = /^(\d+)(?:[.,](\d{1,2}))?$/;

export function parsePercentBp(text: string): number | null {
  const match = percent.exec(text.trim());
  if (match === null) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(bp) ? bp : null;
}

// The percent as typed text with a point, the form parseRate and parsePercentBp read back.
export function bpText(bp: number): string {
  const whole = Math.floor(bp / 100);
  const fraction = String(bp % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction === "" ? String(whole) : `${String(whole)}.${fraction}`;
}

export function formatPercentBp(bp: number, locale: string): string {
  return numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(bp / 10000);
}
