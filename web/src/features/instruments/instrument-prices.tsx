import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { InstrumentCoverage } from "@/features/instruments/instrument-coverage";
import { QuoteSection } from "@/features/instruments/quote-section";
import { useHistoryRefresh } from "@/features/instruments/use-history-refresh";
import { useT } from "@/i18n/i18n-provider";

type Instrument = components["schemas"]["Instrument"];

interface InstrumentPricesProps {
  instrument: Instrument;
  quote: string | null;
  onRecord: () => void;
}

export function InstrumentPrices({
  instrument,
  quote,
  onRecord,
}: InstrumentPricesProps) {
  const t = useT();
  useHistoryRefresh(instrument.code, instrument.coverage);

  return (
    <Stack gap={3}>
      <Heading level={2} size="md">
        {t("instrument.prices.title")}
      </Heading>
      {quote === null && (
        <Text tone="muted">{t("instrument.prices.noQuote")}</Text>
      )}
      {quote !== null && instrument.coverage !== undefined && (
        <InstrumentCoverage
          code={instrument.code}
          coverage={instrument.coverage}
          quote={quote}
          onRecord={onRecord}
        />
      )}
      {quote !== null && <QuoteSection instrument={instrument} quote={quote} />}
    </Stack>
  );
}
