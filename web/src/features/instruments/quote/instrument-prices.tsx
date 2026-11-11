import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { QuoteSection } from "@/features/instruments/quote/quote-section";
import { useHistoryRefresh } from "@/features/instruments/model/use-history-refresh";
import { useT } from "@/i18n/i18n-provider";

type Instrument = components["schemas"]["Instrument"];

interface InstrumentPricesProps {
  instrument: Instrument;
  quote: string | null;
}

export function InstrumentPrices({ instrument, quote }: InstrumentPricesProps) {
  const t = useT();
  useHistoryRefresh(instrument.code, instrument.coverage);

  return (
    <Stack gap={3}>
      <Heading level={2} size="md">
        {t("instrument.quote.title")}
      </Heading>
      {quote === null && (
        <Text tone="muted">{t("instrument.prices.noQuote")}</Text>
      )}
      {quote !== null && <QuoteSection instrument={instrument} quote={quote} />}
    </Stack>
  );
}
