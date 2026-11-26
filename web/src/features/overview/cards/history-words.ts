import type { WalletHistory } from "@/features/overview/cards/wallet";
import { formatMonthSlashYear } from "@/i18n/format";

type Money = NonNullable<WalletHistory["mean"]>;

// The months engraved on a face, in words for a screen reader: "nov/2025 R$ 2.404,16, ...".
// Undefined when the face draws no bar.
export function historyWords(
  history: WalletHistory,
  locale: string,
  money: (amount: Money) => string,
): { months: string; mean: string } | undefined {
  if (history.mean === undefined) return undefined;

  const months = history.bars
    .map((bar) => {
      const month = formatMonthSlashYear(bar.reference, locale);

      return `${month} ${money(bar.amount)}`;
    })
    .join(", ");

  return { months, mean: money(history.mean) };
}
