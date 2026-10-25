import { Badge } from "@slotted/react/badge";
import { Text } from "@slotted/react/typography";

import { CategoryMark } from "@/features/categories";
import type { CategoryEntry } from "@/features/categories";
import { AmountCell } from "@/features/transactions/amount-cell";
import styles from "@/features/transactions/transactions-grid.module.css";
import type { ListRow } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";

// The row's mark is its category's; the payee leads, and the line under it says what else the
// reader needs to place the entry: the description when it adds to the payee, and the accounts.
// On a phone the amount has no column of its own and ends the payee's line (`amount`), so the
// line under it takes the cell's whole width.
export function TitleCell({
  row,
  category,
  amount,
}: {
  row: ListRow;
  category: CategoryEntry | undefined;
  amount?: string | undefined;
}) {
  const t = useT();
  const detail = [
    row.payee !== undefined && row.description !== row.title
      ? row.description
      : "",
    row.accounts,
  ]
    .filter((part) => part !== "")
    .join(" · ");
  const title = row.title || t("transactions.untitled");
  return (
    <span
      className={styles.cell}
      title={detail === "" ? title : `${title} · ${detail}`}
    >
      {row.transfer ? (
        <CategoryMark name="⇄" size="md" />
      ) : (
        <CategoryMark
          name={category?.name ?? "?"}
          color={category?.color}
          icon={category?.icon}
          size="md"
        />
      )}
      <span className={styles.lines}>
        <span className={styles.line}>
          <Text
            weight="medium"
            className={[styles.cut, row.voided ? styles.struck : undefined]
              .filter(Boolean)
              .join(" ")}
          >
            {title}
          </Text>
          {row.voided && (
            <Badge size="sm" tone="secondary">
              {t("transactions.voided")}
            </Badge>
          )}
          {amount !== undefined && (
            <span className={styles.trail}>
              <AmountCell row={row} text={amount} />
            </span>
          )}
        </span>
        {detail !== "" && (
          <Text size="sm" tone="muted" className={styles.cut}>
            {detail}
          </Text>
        )}
      </span>
    </span>
  );
}
