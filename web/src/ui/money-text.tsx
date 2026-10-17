import { formatMoney } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import styles from "@/ui/money-text.module.css";

interface Money {
  amount: number;
  currency: string;
}

// "flow" paints an inflow positive; "balance" paints a negative amount danger; without a tone the text is neutral.
export function MoneyText({
  money,
  scale,
  tone,
}: {
  money: Money;
  scale: number;
  tone?: "flow" | "balance";
}) {
  const [locale] = useAppLocale();
  let toneClass = "";
  if (tone === "flow" && money.amount > 0) toneClass = styles.positive ?? "";
  if (tone === "balance" && money.amount < 0) toneClass = styles.danger ?? "";
  return (
    <span className={[styles.money, toneClass].join(" ").trim()}>
      {formatMoney(money, scale, locale)}
    </span>
  );
}
