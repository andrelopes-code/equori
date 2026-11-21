import {
  ListItem,
  ListItemBody,
  ListItemButton,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemStart,
} from "@slotted/react/list-item";
import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories";
import { AmountCell } from "@/features/transactions/transactions-grid/amount-cell";
import type { ListRow } from "@/features/transactions/transactions-grid/use-transaction-list";
import { StatementMark } from "@/features/transactions/transactions-statement/statement-mark";
import { statementDetail } from "@/features/transactions/transactions-statement/statement-detail";
import styles from "@/features/transactions/transactions-statement/transactions-statement.module.css";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

interface StatementRowProps {
  row: ListRow;
  categories: Map<string, CategoryEntry>;
  scale: (code: string) => number;
  onOpen: (id: string) => void;
}

// One line of the statement (spec 2026-11-21-mobile-statement, MS4 and MS5): the mark, the
// title over its category and accounts, the signed amount at the end.
export function StatementRow({
  row,
  categories,
  scale,
  onOpen,
}: StatementRowProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const entries = row.categoryIds.flatMap((id) => categories.get(id) ?? []);
  const category =
    entries.length > 1
      ? t("transactions.split", { count: entries.length })
      : entries[0]?.name;
  const detail = statementDetail(row, category);
  const title = row.title || t("transactions.untitled");
  const amount = fmt.signed(row.money, scale(row.money.currency));

  return (
    <ListItem className={styles.row}>
      <ListItemButton
        onClick={() => {
          onOpen(row.id);
        }}
      >
        <ListItemStart>
          <StatementMark row={row} category={entries[0]} />
        </ListItemStart>

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
      </ListItemButton>
    </ListItem>
  );
}
