import { Stack } from "@slotted/react/stack";
import { Heading } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { InstrumentCoverage } from "@/features/instruments/coverage/instrument-coverage";
import { SourcesTable } from "@/features/instruments/data/sources-table";
import { useT } from "@/i18n/i18n-provider";

type Instrument = components["schemas"]["Instrument"];

interface InstrumentDataProps {
  instrument: Instrument;
  quote: string | null;
  onRecord: () => void;
}

// Q3 (MQ35): where the quotes come from, how far they reach, and what to do when they fall short.
export function InstrumentData({
  instrument,
  quote,
  onRecord,
}: InstrumentDataProps) {
  const t = useT();
  const { coverage } = instrument;
  if (quote === null || coverage === undefined) return null;

  return (
    <Stack gap={3}>
      <Heading level={2} size="md">
        {t("instrument.data.title")}
      </Heading>
      <InstrumentCoverage
        code={instrument.code}
        coverage={coverage}
        quote={quote}
        onRecord={onRecord}
      />
      {coverage.sources.length > 0 && (
        <SourcesTable sources={coverage.sources} />
      )}
    </Stack>
  );
}
