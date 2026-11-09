import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Heading } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { subtypeLabel } from "@/features/instruments/instrument-labels";
import { useT } from "@/i18n/i18n-provider";

type Instrument = components["schemas"]["Instrument"];

interface InstrumentFactsProps {
  instrument: Instrument;
}

export function InstrumentFacts({ instrument: i }: InstrumentFactsProps) {
  const t = useT();

  return (
    <Stack gap={3}>
      <Heading level={2} size="md">
        {t("instrument.facts")}
      </Heading>
      <DescriptionList variant="ruled" aria-label={t("instrument.facts")}>
        {[
          [
            t("instruments.col.subtype"),
            i.subtype === undefined ? "" : subtypeLabel(t, i.subtype),
          ],
          [t("instruments.col.quote"), i.quote_currency ?? ""],
          [t("instruments.col.exchange"), i.exchange ?? ""],
          [t("instruments.field.scale"), String(i.scale)],
        ]
          .filter(([, value]) => value !== "")
          .map(([term, value]) => (
            <DescriptionListItem key={term}>
              <DescriptionListTerm>{term}</DescriptionListTerm>
              <DescriptionListDescription>{value}</DescriptionListDescription>
            </DescriptionListItem>
          ))}
      </DescriptionList>
    </Stack>
  );
}
