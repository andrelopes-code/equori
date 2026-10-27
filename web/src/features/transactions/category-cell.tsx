import { Button } from "@slotted/react/button";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories";
import { CategorizationMark } from "@/features/transactions/categorization-mark";
import styles from "@/features/transactions/transactions-grid.module.css";
import type { ListRow } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";

export function CategoryCell({
  row,
  categories,
  onCategorize,
  withMark = false,
}: {
  row: ListRow;
  categories: Map<string, CategoryEntry>;
  // Present when the row can be categorized from the list.
  onCategorize?: (() => void) | undefined;
  // Below 600 px the mark of the method stands on the title's line of details instead.
  withMark?: boolean;
}) {
  const t = useT();
  if (row.transfer) {
    return (
      <Text size="sm" tone="muted">
        {t("transactions.transfer")}
      </Text>
    );
  }
  const entries = row.categoryIds.flatMap((id) => {
    const entry = categories.get(id);
    return entry === undefined ? [] : [entry];
  });
  const [first] = entries;
  if (first === undefined) {
    if (!row.uncategorized) return null;
    const label = t("transactions.categorize");
    return onCategorize === undefined ? (
      <Tag size="sm" tone="warning">
        {t("transactions.uncategorized")}
      </Tag>
    ) : (
      <Button size="sm" variant="outline" tone="warning" onClick={onCategorize}>
        {label}
      </Button>
    );
  }
  const name =
    entries.length > 1
      ? t("transactions.split", { count: entries.length })
      : first.name;
  const whole = entries.map((e) => e.path).join(", ");
  // The category's mark leads the row; the cell names it.
  const content = <span className={styles.cut}>{name}</span>;
  const cell =
    onCategorize === undefined ? (
      <span title={whole}>{content}</span>
    ) : (
      <Button
        size="sm"
        variant="ghost"
        tone="secondary"
        title={whole}
        aria-label={t("transactions.changeCategory", { category: whole })}
        onClick={onCategorize}
        className={styles.categoryButton}
      >
        {content}
      </Button>
    );
  if (!withMark) return cell;
  return (
    <span className={styles.marked}>
      {cell}
      <CategorizationMark categorization={row.categorization} />
    </span>
  );
}
