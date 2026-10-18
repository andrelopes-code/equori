import { VisuallyHidden } from "@slotted/react/visually-hidden";

import { formatMoney, formatMoneyParts } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import styles from "@/ui/money-figure.module.css";

interface Money {
  amount: number;
  currency: string;
}

// Families read: typography, stat-card. Neither sizes the parts of one amount apart,
// so the headline figure recesses its symbol and its cents here (ledger sheet L10).
export function MoneyFigure({
  money,
  scale,
  size = "md",
  tone,
}: {
  money: Money;
  scale: number;
  size?: "md" | "lg" | "xl";
  // Forecast figures only.
  tone?: "accent";
}) {
  const [locale] = useAppLocale();
  const parts = formatMoneyParts(money, scale, locale);
  return (
    <span
      data-own="money-figure"
      data-size={size}
      {...(tone === undefined ? {} : { "data-tone": tone })}
      className={styles.figure}
    >
      <VisuallyHidden>{formatMoney(money, scale, locale)}</VisuallyHidden>
      <span aria-hidden="true">
        {parts.sign !== "" && (
          <span data-figure-part="sign" className={styles.sign}>
            {parts.sign}
          </span>
        )}
        <span data-figure-part="symbol" className={styles.symbol}>
          {parts.symbol}
        </span>
        <span data-figure-part="integer">{parts.integer}</span>
        {parts.fraction !== "" && (
          <span data-figure-part="fraction" className={styles.fraction}>
            {parts.fraction}
          </span>
        )}
      </span>
    </span>
  );
}
