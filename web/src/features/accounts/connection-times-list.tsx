import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";

import type { components } from "@/api/schema.gen";
import { formatInstant } from "@/features/accounts/instant";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Connection = components["schemas"]["Connection"];

interface ConnectionTimesListProps {
  connection: Connection;
}

// When the aggregator fetched the bank, when the app read the aggregator, and when the
// aggregator fetches the bank next, side by side under the connection's name.
export function ConnectionTimesList({ connection }: ConnectionTimesListProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const rows = [
    { term: t("sync.bankData"), at: connection.last_item_update_at },
    { term: t("sync.appRead"), at: connection.last_synced_at },
    { term: t("sync.nextFetch"), at: connection.next_item_update_at },
  ];

  return (
    <DescriptionList layout="stack" columns={3} minColumnWidth="sm">
      {rows.map((row) => (
        <DescriptionListItem key={row.term}>
          <DescriptionListTerm>{row.term}</DescriptionListTerm>
          <DescriptionListDescription
            empty={row.at === undefined}
            placeholder={t("sync.notReported")}
          >
            {row.at === undefined ? undefined : formatInstant(row.at, locale)}
          </DescriptionListDescription>
        </DescriptionListItem>
      ))}
    </DescriptionList>
  );
}
