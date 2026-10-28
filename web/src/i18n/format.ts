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

// Every number on screen carries the minus sign of an amount; Intl writes U+002D.
export function numberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions = {},
): { format: (value: number) => string } {
  const format = numberFormat(locale, options);
  return {
    format: (value) =>
      format
        .formatToParts(value)
        .map((part) => (part.type === "minusSign" ? minusSign : part.value))
        .join(""),
  };
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

function currencyPartList(
  m: Money,
  scale: number,
  locale: string,
): { parts: Intl.NumberFormatPart[]; iso: boolean } {
  // O7: Intl reads the decimal string, never a float divided by the scale.
  const plain = formatPlain(m.amount, scale) as `${number}`;
  const fraction = {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  };
  try {
    return {
      parts: numberFormat(locale, {
        style: "currency",
        currency: m.currency,
        ...fraction,
      }).formatToParts(plain),
      iso: true,
    };
  } catch (error) {
    // Intl throws RangeError for codes that are not ISO 4217 (a security ticker).
    if (!(error instanceof RangeError)) throw error;
    return {
      parts: numberFormat(locale, {
        style: "decimal",
        ...fraction,
      }).formatToParts(plain),
      iso: false,
    };
  }
}

export function formatMoneyParts(
  m: Money,
  scale: number,
  locale: string,
): MoneyParts {
  const { parts } = currencyPartList(m, scale, locale);
  const out: MoneyParts = {
    sign: "",
    symbol: m.currency,
    integer: "",
    fraction: "",
  };
  for (const part of parts) {
    if (part.type === "minusSign") out.sign = m.amount < 0 ? minusSign : "";
    else if (part.type === "currency") out.symbol = part.value;
    else if (part.type === "integer" || part.type === "group")
      out.integer += part.value;
    else if (part.type === "decimal" || part.type === "fraction")
      out.fraction += part.value;
  }
  return out;
}

export interface MoneySegment {
  kind: "sign" | "symbol" | "integer" | "fraction" | "literal";
  text: string;
}

// The amount as runs of one kind, in the order and with the literals of the locale's pattern, so a
// caller can draw the symbol or the fraction apart without assuming where the symbol sits.
export function formatMoneySegments(
  m: Money,
  scale: number,
  locale: string,
): MoneySegment[] {
  const { parts, iso } = currencyPartList(m, scale, locale);
  const out: MoneySegment[] = [];
  const push = (kind: MoneySegment["kind"], text: string) => {
    const last = out.at(-1);
    if (last?.kind === kind && (kind === "integer" || kind === "fraction"))
      last.text += text;
    else out.push({ kind, text });
  };
  for (const part of parts) {
    if (part.type === "minusSign") {
      if (m.amount < 0) push("sign", minusSign);
    } else if (part.type === "currency") push("symbol", part.value);
    else if (part.type === "integer" || part.type === "group")
      push("integer", part.value);
    else if (part.type === "decimal" || part.type === "fraction")
      push("fraction", part.value);
    else if (part.type === "literal") push("literal", part.value);
  }
  if (!iso) {
    push("literal", " ");
    push("symbol", m.currency);
  }
  return out;
}

// Sign, symbol, gap and number come in the order and with the literal of the locale's pattern.
export function formatMoney(
  m: Money,
  scale: number,
  locale: string,
  options: { symbol?: boolean } = {},
): string {
  const { parts, iso } = currencyPartList(m, scale, locale);
  const p = formatMoneyParts(m, scale, locale);
  const number = p.integer + p.fraction;
  if (options.symbol === false) return p.sign + number;
  if (!iso) return `${p.sign}${number} ${p.symbol}`;
  return parts
    .map((part) => {
      if (part.type === "minusSign") return p.sign;
      if (part.type === "currency") return p.symbol;
      return part.value;
    })
    .join("");
}

// The literal the locale puts beside the currency symbol; empty when the pattern has none.
export function symbolGap(m: Money, scale: number, locale: string): string {
  const { parts, iso } = currencyPartList(m, scale, locale);
  if (!iso) return " ";
  const at = parts.findIndex((part) => part.type === "currency");
  const next = parts[at + 1];
  if (next?.type === "literal") return next.value;
  const previous = parts[at - 1];
  return previous?.type === "literal" ? previous.value : "";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseAmount(
  text: string,
  scale: number,
  locale: string,
): number | null {
  const sample = numberFormat(locale, {}).formatToParts(1234567.5);
  const group = sample.find((part) => part.type === "group")?.value ?? "";
  const decimal = sample.find((part) => part.type === "decimal")?.value ?? ".";
  let input = text.trim();
  if (/^\s$/u.test(group)) input = input.replace(/[\s\u202f]/gu, group);
  else if (group === "\u2019" || group === "'")
    input = input.replace(/['\u2019]/gu, group);
  const g = escapeRegExp(group);
  const d = escapeRegExp(decimal);
  const grouped = group === "" ? "" : `\\d{1,3}(?:${g}\\d{3})+|`;
  const m = new RegExp(`^(-?)(${grouped}\\d+)(?:${d}(\\d*))?$`, "u").exec(
    input,
  );
  if (m === null) return null;
  const frac = m[3] ?? "";
  if (frac.length > scale) return null;
  const int = group === "" ? (m[2] ?? "") : (m[2] ?? "").split(group).join("");
  const n = Number(`${m[1] ?? ""}${int}${frac.padEnd(scale, "0")}`);
  if (!Number.isSafeInteger(n)) return null;
  return n === 0 ? 0 : n;
}

export function formatDate(iso: string, locale: string): string {
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

export function formatReferenceMonth(month: string, locale: string): string {
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
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of dateFormat(locale, options).formatToParts(utcDate(iso))) {
    out[part.type] = part.value.replace(/\.$/, "");
  }
  return out;
}

// "16 out" / "Oct 16": the day and the month in the order of the locale.
export function formatDayMonth(iso: string, locale: string): string {
  return dateFormat(locale, { day: "numeric", month: "short" })
    .formatToParts(utcDate(iso))
    .filter((part) => part.type === "day" || part.type === "month")
    .map((part) => part.value.replace(/\.$/, ""))
    .join(" ");
}

// "05/11" / "11/05".
export function formatDayMonthNumeric(iso: string, locale: string): string {
  return dateFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    utcDate(iso),
  );
}

// "5 de novembro" / "November 5".
export function formatDayMonthLong(iso: string, locale: string): string {
  return dateFormat(locale, { day: "numeric", month: "long" }).format(
    utcDate(iso),
  );
}

export function formatDayHeader(
  iso: string,
  today: string,
  locale: string,
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
export function formatMonthTitle(month: string, locale: string): string {
  return capitalize(
    dateFormat(locale, { month: "long", year: "numeric" }).format(
      utcDate(`${month}-01`),
    ),
  );
}

// "Outubro" / "October".
export function formatMonthName(month: string, locale: string): string {
  return capitalize(
    dateFormat(locale, { month: "long" }).format(utcDate(`${month}-01`)),
  );
}

// A change reads its sign either way: "+R$ 10,00", "−R$ 10,00".
export function formatSigned(
  m: { amount: number; currency: string },
  scale: number,
  locale: string,
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

// A share in basis points as a percentage of the locale: 5024 reads "50.24%" in en-US.
export function formatBasisPoints(bp: number, locale: string): string {
  return numberFormatter(locale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(bp / 10000);
}

// Basis points of a month as months with one decimal: 66915 reads "6.7" in en-US.
export function formatMonths(bp: number, locale: string): string {
  return numberFormatter(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bp / 10000);
}

// A change in basis points as a signed percentage of the locale: 688 reads "+6.88%" in en-US.
export function formatSignedBasisPoints(bp: number, locale: string): string {
  return numberFormatter(locale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(bp / 10000);
}
