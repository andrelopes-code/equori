import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories";
import type { EntryGroup } from "@/features/planning/income-split/bucket-entries";
import { BucketEntryRow } from "@/features/planning/income-split/bucket-entry-row";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BucketEntryGroupProps {
  group: EntryGroup;
  categories: readonly CategoryEntry[];
  money: (amount: number) => string;
}

// A category of the entries: its name, how many entries it holds and their subtotal, then one
// line per entry.
export function BucketEntryGroup({
  group,
  categories,
  money,
}: BucketEntryGroupProps) {
  const t = useT();
  const named =
    categories.find((c) => c.id === group.categoryId)?.name ??
    t("track.entries.uncategorized");
  const name =
    group.kind === "expense"
      ? named
      : t(
          group.kind === "savings"
            ? "track.entries.savings"
            : "track.entries.goals",
        );
  const count = group.entries.length;

  return (
    <div role="group" aria-label={name}>
      <div className={styles.groupRow}>
        <Text size="sm" weight="medium">
          {name}
        </Text>
        <Text size="xs" tone="muted">
          {count === 1
            ? t("track.entries.count.one")
            : t("track.entries.count", { count: String(count) })}
        </Text>
        <Text size="sm" weight="medium" numeric="tabular">
          {money(group.total)}
        </Text>
      </div>
      {group.entries.map((entry) => (
        <BucketEntryRow
          key={`${entry.transaction_id}-${entry.date}-${String(entry.amount.amount)}`}
          entry={entry}
          money={money}
        />
      ))}
    </div>
  );
}
