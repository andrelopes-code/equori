import type {
  ViewMoney,
  ViewValue,
} from "@/features/assistant/view/view-types";
import { formatDate, numberFormatter } from "@/i18n/format";

export interface ValueFormat {
  money: (m: ViewMoney) => string;
  // A difference: always signed, without the currency symbol.
  delta: (m: ViewMoney) => string;
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
  if (v.text?.startsWith(LABEL) === true) return f.label(v.text, v.count);
  if (v.count !== undefined) return numberFormatter(f.locale).format(v.count);

  return v.text ?? "";
}

// A share below 1% keeps one decimal so it never reads as zero.
function percent(bp: number, locale: string): string {
  const digits = bp !== 0 && Math.abs(bp) < 100 ? 1 : 0;

  return numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(bp / 10000);
}
