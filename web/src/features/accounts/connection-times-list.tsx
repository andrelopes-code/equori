import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { formatInstant } from "@/features/accounts/instant";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Connection = components["schemas"]["Connection"];

interface ConnectionTimesListProps {
  connection: Connection;
}

// When the aggregator fetched the bank, when the app read the aggregator, and when the
// aggregator fetches the bank next: facts to glance at, so they sit in one quiet line.
export function ConnectionTimesList({ connection }: ConnectionTimesListProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const facts = [
    { term: t("sync.bankData"), at: connection.last_item_update_at },
    { term: t("sync.appRead"), at: connection.last_synced_at },
    { term: t("sync.nextFetch"), at: connection.next_item_update_at },
  ];

  return (
    <Inline gap={8} wrap="wrap">
      {facts.map(({ term, at }) => (
        <Inline key={term} gap={2} align="baseline">
          <Text size="sm" tone="muted">
            {term}
          </Text>
          <Text size="sm" tone={at === undefined ? "muted" : undefined}>
            {at === undefined
              ? t("sync.notReported")
              : formatInstant(at, locale)}
          </Text>
        </Inline>
      ))}
    </Inline>
  );
}
