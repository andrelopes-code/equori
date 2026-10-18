import type { Locale } from "@/i18n/locale";

export function formatPlain(minor: number, scale: number): string {
  const digits = Math.abs(minor)
    .toString()
    .padStart(scale + 1, "0");
  const sign = minor < 0 ? "-" : "";
  if (scale === 0) return sign + digits;
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

interface Money {
  amount: number;
  currency: string;
}

export interface MoneyParts {
  sign: string;
  symbol: string;
  integer: string;
  // The decimal separator and the minor digits; empty at scale 0.
  fraction: string;
}

const minusSign = "\u2212";

export function formatMoneyParts(
  m: Money,
  scale: number,
  locale: Locale,
): MoneyParts {
  // O7: Intl reads the decimal string, never a float divided by the scale.
  const plain = formatPlain(m.amount, scale) as `${number}`;
  const fraction = {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  };
  let parts: Intl.NumberFormatPart[];
  let symbol = m.currency;
  try {
    parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: m.currency,
      ...fraction,
    }).formatToParts(plain);
  } catch (error) {
    // Intl throws RangeError for codes that are not ISO 4217 (a security ticker).
    if (!(error instanceof RangeError)) throw error;
    parts = new Intl.NumberFormat(locale, {
      style: "decimal",
      ...fraction,
    }).formatToParts(plain);
  }
  const out: MoneyParts = { sign: "", symbol, integer: "", fraction: "" };
  for (const part of parts) {
    if (part.type === "minusSign") out.sign = m.amount < 0 ? minusSign : "";
    else if (part.type === "currency") symbol = part.value;
    else if (part.type === "integer" || part.type === "group")
      out.integer += part.value;
    else if (part.type === "decimal" || part.type === "fraction")
      out.fraction += part.value;
  }
  out.symbol = symbol;
  return out;
}

// The symbol precedes the number in both locales; pt-BR separates them with a no-break space.
export function formatMoney(
  m: Money,
  scale: number,
  locale: Locale,
  options: { symbol?: boolean } = {},
): string {
  const p = formatMoneyParts(m, scale, locale);
  const number = p.integer + p.fraction;
  if (options.symbol === false) return p.sign + number;
  if (!isISOCurrency(m.currency)) return `${p.sign}${number} ${p.symbol}`;
  const gap = locale === "pt-BR" ? "\u00a0" : "";
  return `${p.sign}${p.symbol}${gap}${number}`;
}

function isISOCurrency(code: string): boolean {
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
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
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utcDate(iso));
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

function utcDate(iso: string): Date {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateParts(
  iso: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    ...options,
  }).formatToParts(utcDate(iso))) {
    out[part.type] = part.value.replace(/\.$/, "");
  }
  return out;
}

// "sex 16" / "Fri 16": the date column of a table within one month.
export function formatWeekdayDay(iso: string, locale: Locale): string {
  const p = dateParts(iso, locale, { weekday: "short", day: "numeric" });
  return `${p.weekday ?? ""} ${p.day ?? ""}`;
}

// "16 out" / "Oct 16".
export function formatDayMonth(iso: string, locale: Locale): string {
  const p = dateParts(iso, locale, { day: "numeric", month: "short" });
  return locale === "en"
    ? `${p.month ?? ""} ${p.day ?? ""}`
    : `${p.day ?? ""} ${p.month ?? ""}`;
}

export function formatDayHeader(
  iso: string,
  today: string,
  locale: Locale,
  words: { today: string; yesterday: string },
): string {
  if (iso === today) return words.today;
  const yesterday = new Date(utcDate(today).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (iso === yesterday) return words.yesterday;
  const weekday = dateParts(iso, locale, { weekday: "short" }).weekday ?? "";
  return `${weekday}, ${formatDayMonth(iso, locale)}`;
}
