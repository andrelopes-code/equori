import { List, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemStart,
} from "@slotted/react/list-item";
import { Skeleton } from "@slotted/react/skeleton";

import styles from "@/features/transactions/transactions-statement/transactions-statement.module.css";
import { useT } from "@/i18n/i18n-provider";

const rows = Array.from({ length: 8 }, (_, index) => index);

// Eight rows in the shape of a statement row while the first page loads (spec MS9).
export function StatementPlaceholder() {
  const t = useT();

  return (
    <List
      aria-label={t("nav.transactions")}
      variant="plain"
      loading
      className={styles.statement}
    >
      <ListSection
        label={
          <Skeleton loading shape="text">
            {t("day.today")}
          </Skeleton>
        }
      >
        {rows.map((index) => (
          <ListItem key={index} className={styles.row}>
            <ListItemStart>
              <Skeleton loading shape="circle" size="md">
                <span className={styles.placeholderMark} />
              </Skeleton>
            </ListItemStart>

            <ListItemBody className={styles.body}>
              <ListItemLabel>
                <Skeleton loading shape="text">
                  {t("transactions.column.description")}
                </Skeleton>
              </ListItemLabel>

              <ListItemDescription>
                <Skeleton loading shape="text">
                  {t("transactions.column.category")}
                </Skeleton>
              </ListItemDescription>
            </ListItemBody>

            <ListItemEnd className={styles.end}>
              <Skeleton loading shape="text">
                {t("transactions.column.amount")}
              </Skeleton>
            </ListItemEnd>
          </ListItem>
        ))}
      </ListSection>
    </List>
  );
}
