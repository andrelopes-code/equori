import { Checkbox } from "@slotted/react/checkbox";

import type { DraftRow } from "@/features/transactions/reimbursement/use-reimbursement-draft";
import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money/money-input";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface ReimbursementRowProps {
  row: DraftRow;
  scale: (code: string) => number;
  onCheckedChange: (checked: boolean) => void;
  onAmountChange: (minor: number) => void;
}

// RD6, RD7: one expense the inflow may repay, one row of fixed height. Its share is asked in the
// row's own column while it is checked.
export function ReimbursementRow({
  row,
  scale,
  onCheckedChange,
  onAmountChange,
}: ReimbursementRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const { transaction, remaining } = row.item;
  const currency = remaining.currency;
  const left = fmt.money(remaining, scale(currency));

  return (
    <li className={styles.row} data-checked={row.checked ? "" : undefined}>
      <Checkbox
        className={styles.check}
        checked={row.checked}
        onCheckedChange={onCheckedChange}
        description={
          <>
            <span>{formatDate(transaction.date, locale)}</span>
            <span className={styles.inlineRemaining}>
              {t("reimbursement.left", { remaining: left })}
            </span>
          </>
        }
      >
        <span className={styles.checkName}>{transaction.description}</span>
      </Checkbox>

      <span className={styles.remaining}>{left}</span>

      <span className={styles.shareCell}>
        {row.checked && (
          <MoneyInput
            size="field"
            className={styles.share}
            aria-label={t("reimbursement.amount", {
              description: transaction.description,
            })}
            value={row.amount}
            onChange={onAmountChange}
            currency={currency}
            scale={scale(currency)}
            sign="neutral"
            invalid={row.amount <= 0 || row.amount > remaining.amount}
          />
        )}
      </span>
    </li>
  );
}
