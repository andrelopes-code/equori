import {
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Text } from "@slotted/react/typography";

import { AmountCell } from "@/features/transactions/transactions-grid/amount-cell";
import type { ListRow } from "@/features/transactions/transactions-grid/use-transaction-list";
import { statementDetail } from "@/features/transactions/transactions-statement/statement-detail";
import styles from "@/features/transactions/transactions-statement/transactions-statement.module.css";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

interface StatementRowTextProps {
  row: ListRow;
  category: string | undefined;
  scale: (code: string) => number;
}

// The title over its category and accounts, and the signed amount at the end (spec
// 2026-11-21-mobile-statement, MS4 and MS5).
export function StatementRowText({
  row,
  category,
  scale,
}: StatementRowTextProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const detail = statementDetail(row, category);
  const title = row.title || t("transactions.untitled");
  const amount = fmt.signed(row.money, scale(row.money.currency));

  return (
    <>
      <ListItemBody className={styles.body}>
        <ListItemLabel>
          <span
            className={cx(styles.cut, row.voided ? styles.struck : undefined)}
          >
            {title}
          </span>
        </ListItemLabel>

        <ListItemDescription>
          <span className={styles.cut}>
            {detail.flag === "uncategorized" && (
              <Text size="sm" tone="accent" weight="medium">
                {t("transactions.uncategorized")}
              </Text>
            )}
            {detail.flag === "voided" && (
              <Text size="sm" weight="medium">
                {t("transactions.voided")}
              </Text>
            )}
            {detail.flag !== undefined && detail.text !== "" && " · "}
            {detail.text}
          </span>
        </ListItemDescription>
      </ListItemBody>

      <ListItemEnd className={styles.end}>
        <AmountCell row={row} text={amount} />
      </ListItemEnd>
    </>
  );
}
