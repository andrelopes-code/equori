import { Checkbox } from "@slotted/react/checkbox";
import {
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemStart,
} from "@slotted/react/list-item";

import type { CategoryEntry } from "@/features/categories";
import type { ListRow } from "@/features/transactions/transactions-grid/use-transaction-list";
import { StatementMark } from "@/features/transactions/transactions-statement/statement-mark";
import { StatementRowText } from "@/features/transactions/transactions-statement/statement-row-text";
import styles from "@/features/transactions/transactions-statement/transactions-statement.module.css";
import { useT } from "@/i18n/i18n-provider";

interface StatementRowProps {
  row: ListRow;
  categories: Map<string, CategoryEntry>;
  scale: (code: string) => number;
  onOpen: (id: string) => void;
  // Selection mode: the row is a label of its checkbox, and a tap toggles it (spec MS7).
  selecting: boolean;
  selected: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
}

// One line of the statement: a tap opens the transaction, or toggles it in selection mode.
export function StatementRow({
  row,
  categories,
  scale,
  onOpen,
  selecting,
  selected,
  onSelectedChange,
}: StatementRowProps) {
  const t = useT();

  const entries = row.categoryIds.flatMap((id) => categories.get(id) ?? []);
  const category =
    entries.length > 1
      ? t("transactions.split", { count: entries.length })
      : entries[0]?.name;
  const text = <StatementRowText row={row} category={category} scale={scale} />;

  if (selecting) {
    return (
      <ListItem className={styles.row} selected={selected}>
        <ListItemContent render={(props) => <label {...props} />}>
          <ListItemStart>
            <Checkbox
              checked={selected}
              aria-label={t("transactions.selectRow", { row: row.title })}
              onCheckedChange={(checked) => {
                onSelectedChange(row.id, checked);
              }}
            />
          </ListItemStart>
          {text}
        </ListItemContent>
      </ListItem>
    );
  }

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
        {text}
      </ListItemButton>
    </ListItem>
  );
}
