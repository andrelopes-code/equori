import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import type { components } from "@/api/schema.gen";
import { instantLabel } from "@/features/connections/instant-label";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Connection = components["schemas"]["Connection"];

// A95: when the aggregator fetched the bank, when the app read the aggregator, and when the
// aggregator fetches the bank next.
export function ConnectionTimes({
  connection,
  title,
}: {
  connection: Connection;
  title: string;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const rows = [
    { term: t("sync.bankData"), at: connection.last_item_update_at },
    { term: t("sync.appRead"), at: connection.last_synced_at },
    { term: t("sync.nextFetch"), at: connection.next_item_update_at },
  ];
  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <DescriptionList>
          {rows.map((row) => (
            <DescriptionListItem key={row.term}>
              <DescriptionListTerm>{row.term}</DescriptionListTerm>
              <DescriptionListDescription
                empty={row.at === undefined}
                placeholder={t("sync.notReported")}
              >
                {row.at === undefined
                  ? undefined
                  : instantLabel(row.at, today, locale)}
              </DescriptionListDescription>
            </DescriptionListItem>
          ))}
        </DescriptionList>
      </SectionBody>
    </Section>
  );
}
