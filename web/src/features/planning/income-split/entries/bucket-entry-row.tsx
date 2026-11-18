import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useAppLocale } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

type Entry = components["schemas"]["BudgetBucketEntry"];

interface BucketEntryRowProps {
  entry: Entry;
  // The title of an entry with neither payee nor description: the name of its group.
  fallback: string;
  money: (amount: number) => string;
}

// One entry on one line, a link to its transaction: the day, the payee (the description
// without one, the group's name without either) and the amount. An allocation to a goal has no
// transaction and links to the goals (planning coherence A255).
export function BucketEntryRow({
  entry,
  fallback,
  money,
}: BucketEntryRowProps) {
  const [locale] = useAppLocale();
  const day = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${entry.date}T00:00:00Z`));

  return (
    <Link
      variant="neutral"
      underline="hover"
      className={styles.entryRow}
      render={
        entry.transaction_id === undefined
          ? routeTo({ to: "/goals" })
          : routeTo({
              to: "/transactions/$id",
              params: { id: entry.transaction_id },
            })
      }
    >
      <Text size="sm" tone="muted">
        {day}
      </Text>
      <Text size="sm">{entry.payee ?? (entry.description || fallback)}</Text>
      <Text size="sm" numeric="tabular">
        {money(entry.amount.amount)}
      </Text>
    </Link>
  );
}
