import { CategoryMark } from "@/features/categories";
import type { CategoryEntry } from "@/features/categories";
import type { ListRow } from "@/features/transactions/transactions-grid/use-transaction-list";

interface StatementMarkProps {
  row: ListRow;
  category: CategoryEntry | undefined;
}

// The row's mark is its category's; a transfer carries the arrows, an uncategorized row the "?".
export function StatementMark({ row, category }: StatementMarkProps) {
  if (row.transfer) return <CategoryMark name="⇄" size="md" />;

  return (
    <CategoryMark
      name={category?.name ?? "?"}
      color={category?.color}
      icon={category?.icon}
      size="md"
    />
  );
}
