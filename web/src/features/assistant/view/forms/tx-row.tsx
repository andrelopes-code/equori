import type { TxItem } from "@/features/assistant/view/forms/view-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TxRowProps {
  item: TxItem;
}

// One transaction: its day, its name, where it was paid and its category, and its amount.
export function TxRow({ item }: TxRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();

  const [, month = "1", day = "1"] = item.date.split("-");
  const monthName = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, Number(month) - 1, 1)));
  const meta =
    item.category === ""
      ? item.account
      : t("assistantView.txs.meta", {
          account: item.account,
          category: item.category,
        });

  return (
    <li className={styles.event}>
      <span className={styles.day}>
        <b>{Number(day)}</b>
        {monthName}
      </span>

      <span className={styles.eventText}>
        <span className={styles.eventName}>{item.name}</span>
        <span className={styles.eventMeta}>{meta}</span>
      </span>

      <span className={styles.eventValue}>{format.money(item.amount)}</span>
    </li>
  );
}
