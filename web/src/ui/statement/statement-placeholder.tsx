import { List, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemStart,
} from "@slotted/react/list-item";
import { Skeleton } from "@slotted/react/skeleton";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/statement/statement.module.css";

const rows = Array.from({ length: 8 }, (_, index) => index);

interface StatementPlaceholderProps {
  label: string;
}

// Eight rows in the shape of a statement row while the first page loads (spec
// 2026-11-21-mobile-statement, MS9).
export function StatementPlaceholder({ label }: StatementPlaceholderProps) {
  const t = useT();

  return (
    <List
      aria-label={label}
      variant="plain"
      fill="inset"
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
            <ListItemContent>
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
            </ListItemContent>
          </ListItem>
        ))}
      </ListSection>
    </List>
  );
}
