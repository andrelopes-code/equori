import { Badge } from "@slotted/react/badge";
import { Text } from "@slotted/react/typography";

import styles from "@/features/transactions/transactions-grid.module.css";
import type { ListRow } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";

// The payee leads; the description follows in the muted ink when it says something more.
export function TitleCell({ row }: { row: ListRow }) {
  const t = useT();
  const detail =
    row.payee !== undefined && row.description !== row.title
      ? row.description
      : "";
  const whole = detail === "" ? row.title : `${row.title} · ${detail}`;
  return (
    <span className={styles.cell} title={whole}>
      <Text weight="medium" className={styles.cut}>
        {row.title || t("transactions.untitled")}
      </Text>
      {detail !== "" && (
        <Text tone="muted" className={styles.cut}>
          {detail}
        </Text>
      )}
      {row.voided && (
        <Badge size="sm" tone="secondary">
          {t("transactions.voided")}
        </Badge>
      )}
    </span>
  );
}
