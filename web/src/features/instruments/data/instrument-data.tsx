import { Stack } from "@slotted/react/stack";
import { Heading } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { InstrumentDataLayer } from "@/features/instruments/data/instrument-data-layer";
import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

type Instrument = components["schemas"]["Instrument"];

interface InstrumentDataProps {
  instrument: Instrument;
  quote: string | null;
  onRecord: () => void;
}

// L2 (MQ35): the summary line of the quotes and the button of the layer that holds where they
// come from, how far they reach and what to do when they fall short.
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
    <Stack gap={3}>
      <Heading level={2} size="md">
        {t("instrument.data.title")}
      </Heading>

      <DetailDialog
        title={t("instrument.data.title")}
        description={t("instrument.data.layer.description")}
        summary={summary}
        triggerLabel={t("instrument.data.open")}
      >
        <InstrumentDataLayer
          instrument={instrument}
          coverage={coverage}
          quote={quote}
          onRecord={onRecord}
        />
      </DetailDialog>
    </Stack>
  );
}
