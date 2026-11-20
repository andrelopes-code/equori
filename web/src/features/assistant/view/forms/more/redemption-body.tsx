import type { RedemptionData } from "@/features/assistant/view/forms/more/more-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

const STEPS = ["gross", "income_tax", "iof", "custody_fee"] as const;

// A redemption from what the security pays to what reaches the account, the withholdings between.
export function RedemptionBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const d = data as RedemptionData;

  return (
    <ul className={styles.ledger}>
      {STEPS.map((s) => (
        <li key={s}>
          <span className={styles.rowName}>
            {t(`assistantView.redemption.${s}`)}
          </span>
          <span className={styles.num}>
            {s === "gross"
              ? format.money(d[s])
              : format.delta({ ...d[s], amount: -d[s].amount })}
          </span>
        </li>
      ))}
      <li className={styles.ledgerSum}>
        <span>{t("assistantView.redemption.net")}</span>
        <span className={styles.num}>{format.money(d.net)}</span>
      </li>
    </ul>
  );
}
