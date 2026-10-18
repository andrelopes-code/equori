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
  const g = `\\${group}`;
  const d = `\\${decimal}`;
  const m = new RegExp(
    `^(-?)(\\d{1,3}(?:${g}\\d{3})+|\\d+)(?:${d}(\\d*))?$`,
  ).exec(text.trim());
  if (m === null) return null;
  const frac = m[3] ?? "";
  if (frac.length > scale) return null;
  const int = (m[2] ?? "").split(group).join("");
  const n = Number(`${m[1] ?? ""}${int}${frac.padEnd(scale, "0")}`);
  if (!Number.isSafeInteger(n)) return null;
  return n === 0 ? 0 : n;
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

export function formatReferenceMonth(month: string, locale: Locale): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}
