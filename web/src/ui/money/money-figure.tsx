import styles from "@/ui/money/money-figure.module.css";
import { useMoneyFormat } from "@/privacy/use-money-format";

const plusSign = "+";

// An amount inside a sentence or a row: tabular figures, with the currency symbol and the
// fraction a weight lighter than the whole units the reader compares.
export function MoneyFigure({
  amount,
  currency,
  scale,
  plus = false,
}: {
  amount: number;
  currency: string;
  scale: number;
  // An amount that enters is written with a plus sign: the sign carries the direction.
  plus?: boolean;
}) {
  const fmt = useMoneyFormat();
  const parts = fmt.parts({ amount, currency }, scale);
  const sign = plus && amount > 0 ? plusSign : parts.sign;

  return (
    <span className={styles.figure}>
      {sign}
      <span className={styles.minor}>{parts.symbol}</span>
      {" "}
      {parts.integer}
      <span className={styles.minor}>{parts.fraction}</span>
    </span>
  );
}
