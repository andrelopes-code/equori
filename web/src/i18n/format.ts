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

// Building an Intl formatter costs about a hundred times a format call, and a grid formats every
// visible cell on each render; formatters are kept per locale and options.
const numberFormats = new Map<string, Intl.NumberFormat | RangeError>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (format === undefined) {
    try {
      format = new Intl.NumberFormat(locale, options);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      format = error;
    }
    numberFormats.set(key, format);
  }
  if (format instanceof RangeError) throw format;
  return format;
}

function dateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options });
    dateFormats.set(key, format);
  }
  return format;
}

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
    parts = numberFormat(locale, {
      style: "currency",
      currency: m.currency,
      ...fraction,
    }).formatToParts(plain);
  } catch (error) {
    // Intl throws RangeError for codes that are not ISO 4217 (a security ticker).
    if (!(error instanceof RangeError)) throw error;
    parts = numberFormat(locale, {
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
    numberFormat("en", { style: "currency", currency: code });
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
  return dateFormat(locale, {
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
  return dateFormat(locale, { month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, m - 1, 1)),
  );
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
  for (const part of dateFormat(locale, options).formatToParts(utcDate(iso))) {
    out[part.type] = part.value.replace(/\.$/, "");
  }
  return out;
}

// "16 out" / "Oct 16".
export function formatDayMonth(iso: string, locale: Locale): string {
  const p = dateParts(iso, locale, { day: "numeric", month: "short" });
  return locale === "en"
    ? `${p.month ?? ""} ${p.day ?? ""}`
    : `${p.day ?? ""} ${p.month ?? ""}`;
}

// "05/11" / "11/05".
export function formatDayMonthNumeric(iso: string, locale: Locale): string {
  return dateFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    utcDate(iso),
  );
}

// "5 de novembro" / "November 5".
export function formatDayMonthLong(iso: string, locale: Locale): string {
  return dateFormat(locale, { day: "numeric", month: "long" }).format(
    utcDate(iso),
  );
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

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

// "Outubro de 2026" / "October 2026".
export function formatMonthTitle(month: string, locale: Locale): string {
  return capitalize(
    dateFormat(locale, { month: "long", year: "numeric" }).format(
      utcDate(`${month}-01`),
    ),
  );
}

// "Outubro" / "October".
export function formatMonthName(month: string, locale: Locale): string {
  return capitalize(
    dateFormat(locale, { month: "long" }).format(utcDate(`${month}-01`)),
  );
}

// A change reads its sign either way: "+R$ 10,00", "−R$ 10,00".
export function formatSigned(
  m: { amount: number; currency: string },
  scale: number,
  locale: Locale,
  options: { symbol?: boolean } = {},
): string {
  const text = formatMoney(m, scale, locale, options);
  return m.amount > 0 ? `+${text}` : text;
}

export function shiftDate(iso: string, days: number): string {
  return new Date(utcDate(iso).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
