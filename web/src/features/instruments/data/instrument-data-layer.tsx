import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { InstrumentCoverage } from "@/features/instruments/coverage/instrument-coverage";
import { SourcesTable } from "@/features/instruments/data/sources-table";
import { useT } from "@/i18n/i18n-provider";

type Instrument = components["schemas"]["Instrument"];
type Coverage = components["schemas"]["InstrumentCoverage"];

interface InstrumentDataLayerProps {
  instrument: Instrument;
  coverage: Coverage;
  quote: string;
  onRecord: () => void;
}

// The body of the data layer (L2): the coverage with its actions, the sources and, as a note
// under them, the scale.
export function InstrumentDataLayer({
  instrument,
  coverage,
  quote,
  onRecord,
}: InstrumentDataLayerProps) {
  const t = useT();

  return (
    <Stack gap={4}>
      <InstrumentCoverage
        code={instrument.code}
        coverage={coverage}
        quote={quote}
        onRecord={onRecord}
      />

      {coverage.sources.length > 0 && (
        <SourcesTable sources={coverage.sources} />
      )}

      <Text size="sm" tone="muted">
        {t("instrument.data.scale", { scale: instrument.scale })}
      </Text>
    </Stack>
  );
}
