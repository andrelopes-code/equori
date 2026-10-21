import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories";
import styles from "@/features/transactions/transactions-grid.module.css";
import type { ListRow } from "@/features/transactions/use-transaction-list";
import { useT } from "@/i18n/i18n-provider";

export function CategoryCell({
  row,
  categories,
  onCategorize,
}: {
  row: ListRow;
  categories: Map<string, CategoryEntry>;
  // Present when the row can be categorized from the list.
  onCategorize?: (() => void) | undefined;
}) {
  const t = useT();
  if (row.transfer) {
    return <Text tone="muted">{t("transactions.transfer")}</Text>;
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
      <Text tone="warning">{t("transactions.uncategorized")}</Text>
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
  return onCategorize === undefined ? (
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
}
