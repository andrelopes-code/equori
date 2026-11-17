import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useAppLocale } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

type Entry = components["schemas"]["BudgetBucketEntry"];

interface BucketEntryRowProps {
  entry: Entry;
  money: (amount: number) => string;
}

// One entry on one line, a link to its transaction: the day, the payee (the description
// without one) and the amount.
export function BucketEntryRow({ entry, money }: BucketEntryRowProps) {
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
      render={routeTo({
        to: "/transactions/$id",
        params: { id: entry.transaction_id },
      })}
    >
      <Text size="sm" tone="muted">
        {day}
      </Text>
      <Text size="sm">{entry.payee ?? entry.description}</Text>
      <Text size="sm" numeric="tabular">
        {money(entry.amount.amount)}
      </Text>
    </Link>
  );
}
