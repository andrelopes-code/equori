import type { Locale } from "@/i18n/locale";

export function formatPlain(minor: number, scale: number): string {
  const digits = Math.abs(minor)
    .toString()
    .padStart(scale + 1, "0");
  const sign = minor < 0 ? "-" : "";
  if (scale === 0) return sign + digits;
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function formatMoney(
  m: { amount: number; currency: string },
  scale: number,
  locale: Locale,
): string {
  const plain = formatPlain(m.amount, scale) as `${number}`;
  const fraction = {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  };
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: m.currency,
      ...fraction,
    }).format(plain);
  } catch (error) {
    // Intl throws RangeError for codes that are not ISO 4217 (a security ticker).
    if (!(error instanceof RangeError)) throw error;
    const number = new Intl.NumberFormat(locale, {
      style: "decimal",
      ...fraction,
    }).format(plain);
    return `${number} ${m.currency}`;
  }
}

export function parseAmount(
  text: string,
  scale: number,
  locale: Locale,
): number | null {
  const [group, decimal] = locale === "pt-BR" ? [".", ","] : [",", "."];
  const t = text.trim().split(group).join("");
  const m = new RegExp(`^(-?)(\\d+)(?:\\${decimal}(\\d*))?$`).exec(t);
  if (m === null) return null;
  const frac = m[3] ?? "";
  if (frac.length > scale) return null;
  const n = Number(`${m[1] ?? ""}${m[2] ?? ""}${frac.padEnd(scale, "0")}`);
  return Number.isSafeInteger(n) ? n : null;
}

export function formatDate(iso: string, locale: Locale): string {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function todayISO(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}
