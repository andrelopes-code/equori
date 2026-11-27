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

// The lengths of the title, the subtitle and the amount of each row, in turn, so the rows do
// not read as one repeated stamp.
const rows = Array.from({ length: 8 }, (_, index) => ({
  key: index,
  title: ["62%", "48%", "71%", "55%"][index % 4],
  subtitle: ["44%", "58%", "36%", "50%"][index % 4],
  amount: ["4.5rem", "3.75rem", "5rem"][index % 3],
}));

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
        {rows.map((row) => (
          <ListItem key={row.key} className={styles.row}>
            <ListItemContent>
              <ListItemStart>
                <Skeleton loading shape="square" size="lg" />
              </ListItemStart>

              {/* Workaround for Slotted issue #223: a placeholder that covers a word paints its
                  whole line box, so the lines are bare bars, one cap tall inside the line. */}
              <ListItemBody className={styles.body}>
                <ListItemLabel>
                  <Skeleton loading shape="text" inlineSize={row.title} />
                </ListItemLabel>

                <ListItemDescription>
                  <Skeleton loading shape="text" inlineSize={row.subtitle} />
                </ListItemDescription>
              </ListItemBody>

              <ListItemEnd className={styles.end}>
                <Skeleton loading shape="text" inlineSize={row.amount} />
              </ListItemEnd>
            </ListItemContent>
          </ListItem>
        ))}
      </ListSection>
    </List>
  );
}
