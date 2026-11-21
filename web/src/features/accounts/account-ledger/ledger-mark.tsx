import { CategoryMark } from "@/features/categories";
import type { CategoryEntry } from "@/features/categories";
import type { LedgerRow } from "@/features/accounts/account-ledger/running-balance";

interface LedgerMarkProps {
  row: LedgerRow;
  categories: Map<string, CategoryEntry>;
  // The uncategorized system accounts, drawn as "?" as on /transactions.
  uncategorized: ReadonlySet<string>;
}

// The mark of a movement: the category it went to or came from; the arrows for a movement between
// two of the reader's accounts.
export function LedgerMark({
  row,
  categories,
  uncategorized,
}: LedgerMarkProps) {
  if (row.counterparts.some((id) => uncategorized.has(id))) {
    return <CategoryMark name="?" size="md" />;
  }

  const category = row.counterparts
    .map((id) => categories.get(id))
    .find((entry) => entry !== undefined);

  if (category === undefined && row.counterparts.length > 0) {
    return <CategoryMark name="⇄" size="md" />;
  }

  return (
    <CategoryMark
      name={category?.name ?? "?"}
      color={category?.color}
      icon={category?.icon}
      size="md"
    />
  );
}
