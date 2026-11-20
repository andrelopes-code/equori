import { TransactionTrail } from "@/features/assistant/view/forms/transaction-trail";
import type { TransactionData } from "@/features/assistant/view/forms/view-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// One transaction as a receipt: the amount first, its postings that sum to zero, the versions it
// went through and its attachments.
export function TransactionBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const tx = data as TransactionData;

  const classLabel = (c: string) => {
    const key = catalogKey(`assistantView.class.${c}`);
    return key === undefined ? c : t(key);
  };
  const sum = tx.postings.reduce((s, p) => s + p.amount.amount, 0);
  const currency = tx.postings[0]?.amount.currency ?? tx.item.amount.currency;
  const meta = [tx.item.account, tx.item.category, ...tx.tags]
    .filter((x) => x !== "")
    .join(" · ");

  return (
    <div className={styles.rcpt}>
      <div className={styles.rcptHead}>
        <span className={styles.rcptWho}>
          <b>{tx.item.name}</b>
          <small>{meta}</small>
        </span>
        <span className={styles.rcptAmt}>{format.money(tx.item.amount)}</span>
      </div>

      <ul
        className={styles.ledger}
        aria-label={t("assistantView.transaction.postings")}
      >
        {tx.postings.map((p) => (
          <li key={p.account}>
            <span className={styles.rowName}>
              {p.account}
              <small>{classLabel(p.class)}</small>
            </span>
            <span
              className={cx(styles.num, p.amount.amount < 0 && styles.down)}
            >
              {format.delta(p.amount)}
            </span>
          </li>
        ))}
        <li className={styles.ledgerSum}>
          <span>{t("assistantView.transaction.sum")}</span>
          <span className={styles.num}>
            {format.delta({ amount: sum, currency })}
          </span>
        </li>
      </ul>

      <TransactionTrail history={tx.history} />

      {tx.attachments.map((a) => (
        <span key={a.file_name} className={styles.attach}>
          <span className={styles.icon14}>
            <AssistantIcon name="paperclip" />
          </span>
          <span className={styles.rowName}>{a.file_name}</span>
        </span>
      ))}
    </div>
  );
}
