import { formatMoney } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import styles from "@/ui/money-text.module.css";

interface Money {
  amount: number;
  currency: string;
}

// Ledger sheet L9: every sign reads in the neutral text colour. symbol={false} drops the
// currency symbol, for a column of base-currency amounts whose header names the value.
export function MoneyText({
  money,
  scale,
  symbol = true,
}: {
  money: Money;
  scale: number;
  symbol?: boolean;
}) {
  const [locale] = useAppLocale();
  return (
    <span className={styles.money}>
      {formatMoney(money, scale, locale, { symbol })}
    </span>
  );
}
