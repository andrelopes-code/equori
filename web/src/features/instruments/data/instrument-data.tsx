import { Inline } from "@slotted/react/inline";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { InstrumentDataLayer } from "@/features/instruments/data/instrument-data-layer";
import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import { PriceDetails } from "@/features/instruments/price-table/price-details";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

type Instrument = components["schemas"]["Instrument"];

interface InstrumentDataProps {
  instrument: Instrument;
  quote: string | null;
  onRecord: () => void;
}

// L2 (MQ35), IM11: the summary line of the quotes, the button of the layer that lists them by date
// and the button of the layer that holds where they come from, how far they reach and what to do
// when they fall short.
export function InstrumentData({
  instrument,
  quote,
  onRecord,
}: InstrumentDataProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const { coverage } = instrument;

  if (quote === null || coverage === undefined) return null;

  const { count, first, last, sources } = coverage;
  const named = sources
    .filter((s) => s.enabled)
    .map((s) => sourceLabel(t, s.id));
  const range = {
    count: numberFormatter(locale).format(count),
    from: first ? formatDate(first, locale) : "",
    to: last ? formatDate(last, locale) : "",
  };
  const summary =
    count === 0 || !first || !last
      ? null
      : t(
          named.length === 0
            ? "instrument.data.summaryNoSources"
            : "instrument.data.summary",
          { ...range, sources: named.join(", ") },
        );

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("instrument.data.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Inline align="center" gap={4} wrap="wrap">
          {summary !== null && <Text size="sm">{summary}</Text>}

          {count > 0 && first && last && (
            <PriceDetails
              code={instrument.code}
              quote={quote}
              first={first}
              last={last}
            />
          )}

          <DetailDialog
            title={t("instrument.data.title")}
            description={t("instrument.data.layer.description")}
            summary={null}
            triggerLabel={t("instrument.data.open")}
          >
            <InstrumentDataLayer
              instrument={instrument}
              coverage={coverage}
              quote={quote}
              onRecord={onRecord}
            />
          </DetailDialog>
        </Inline>
      </SectionBody>
    </Section>
  );
}
