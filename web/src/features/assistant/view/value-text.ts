import { monthText } from "@/features/assistant/view/month-text";
import type {
  ViewMoney,
  ViewValue,
} from "@/features/assistant/view/view-types";
import { formatDate, numberFormatter } from "@/i18n/format";

export interface ValueFormat {
  money: (m: ViewMoney) => string;
  // A difference: always signed, without the currency symbol.
  delta: (m: ViewMoney) => string;
  // A label on a chart column: whole units of the currency, signed when it is a flow.
  whole: (m: ViewMoney, signed: boolean) => string;
  // A catalog key the server sent as a label, such as the rest row of a ranking.
  label: (key: string, count: number | undefined) => string;
  locale: string;
}

const LABEL = "assistantView.";

// One typed figure of a view as text (answer views design, V7).
export function valueText(v: ViewValue, f: ValueFormat): string {
  if (v.money !== undefined) return f.money(v.money);
  if (v.bp !== undefined) return percent(v.bp, f.locale);
  if (v.date !== undefined) return formatDate(v.date, f.locale);
  if (v.month !== undefined) return monthText(v.month, f.locale);
  if (v.times !== undefined) return times(v.times, f.locale);
  if (v.rate !== undefined) return rate(v.rate, f.locale);
  if (v.points !== undefined)
    return f.label("assistantView.unit.points", v.points);
  if (v.text?.startsWith(LABEL) === true) return f.label(v.text, v.count);
  if (v.count !== undefined) return numberFormatter(f.locale).format(v.count);

  return v.text ?? "";
}

// A share below 10% keeps one decimal: 158 bp reads 1.6%, not 2%, and a small share never reads as
// zero.
function percent(bp: number, locale: string): string {
  const digits = bp !== 0 && Math.abs(bp) < 1000 ? 1 : 0;

  return numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(bp / 10000);
}

// A multiple in basis points with one decimal: 107098 reads 10.7× (10,7× in pt-BR).
function times(bp: number, locale: string): string {
  const n = numberFormatter(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bp / 10000);

  return `${n}×`;
}

// A return in basis points with one or two decimals: 1429 reads 14.29%, 1380 reads 13.8%.
export function rate(bp: number, locale: string): string {
  return numberFormatter(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(bp / 10000);
}
