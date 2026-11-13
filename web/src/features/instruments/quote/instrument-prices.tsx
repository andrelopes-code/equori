import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { QuoteSection } from "@/features/instruments/quote/quote-section";
import { useHistoryRefresh } from "@/features/instruments/model/use-history-refresh";
import { useT } from "@/i18n/i18n-provider";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

type Instrument = components["schemas"]["Instrument"];

interface InstrumentPricesProps {
  instrument: Instrument;
  quote: string | null;
}

export function InstrumentPrices({ instrument, quote }: InstrumentPricesProps) {
  const t = useT();
  useHistoryRefresh(instrument.code, instrument.coverage);

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("instrument.quote.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        {quote === null && (
          <Text tone="muted">{t("instrument.prices.noQuote")}</Text>
        )}
        {quote !== null && (
          <QuoteSection instrument={instrument} quote={quote} />
        )}
      </SectionBody>
    </Section>
  );
}
