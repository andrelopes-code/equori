import styles from "@/ui/money-figure.module.css";
import { useMoneyFormat } from "@/privacy/use-money-format";

// An amount inside a sentence or a row: tabular figures, with the currency symbol and the
// fraction a weight lighter than the whole units the reader compares.
export function MoneyFigure({
  amount,
  currency,
  scale,
}: {
  amount: number;
  currency: string;
  scale: number;
}) {
  const fmt = useMoneyFormat();
  const parts = fmt.parts({ amount, currency }, scale);
  return (
    <span className={styles.figure}>
      {parts.sign}
      <span className={styles.minor}>{parts.symbol}</span>
      {" "}
      {parts.integer}
      <span className={styles.minor}>{parts.fraction}</span>
    </span>
  );
}
