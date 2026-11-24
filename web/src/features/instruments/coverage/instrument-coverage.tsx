import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { useRequestHistory } from "@/features/instruments/api";
import {
  coverageRange,
  historyState,
  quoteAge,
} from "@/features/instruments/model/coverage-line";
import { CoverageActions } from "@/features/instruments/coverage/coverage-actions";
import { HistoryDialog } from "@/features/instruments/coverage/history-dialog";
import { HistoryNotice } from "@/features/instruments/coverage/history-notice";
import { InstrumentPriceImportDialog } from "@/features/instruments/price-import/instrument-price-import-dialog";
import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import { formatDate, formatRelativeDays, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Coverage = components["schemas"]["InstrumentCoverage"];

interface InstrumentCoverageProps {
  code: string;
  coverage: Coverage;
  quote: string | null;
  onRecord: () => void;
}

// MQ35: the dates, the count and the sources of the stored quotes, and the history load.
export function InstrumentCoverage({
  code,
  coverage,
  quote,
  onRecord,
}: InstrumentCoverageProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const retry = useRequestHistory();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const range = coverageRange(coverage);
  const history = historyState(coverage);
  const age = quoteAge(coverage, today);
  const loadable =
    range.kind === "none"
      ? range.canRequest
      : coverage.sources.some((s) => s.enabled);

  function handleRetry() {
    if (history.kind === "failed") retry.mutate({ code, from: history.from });
  }

  return (
    <Stack gap={2}>
      {range.kind === "none" ? (
        <Text tone="muted">{t("instruments.coverage.none")}</Text>
      ) : (
        <Text tone="muted">
          {t(
            range.source === null
              ? "instruments.coverage.range"
              : "instruments.coverage.rangeSource",
            {
              first: formatDate(range.first, locale),
              last: formatDate(range.last, locale),
              count: numberFormatter(locale).format(range.count),
              source: range.source === null ? "" : sourceLabel(t, range.source),
            },
          )}
        </Text>
      )}
      {age !== null && (
        <Text tone="muted">
          {t("instruments.coverage.age", {
            age: formatRelativeDays(-age, locale),
          })}
        </Text>
      )}
      {coverage.missing > 0 && (
        <Text tone="muted">
          {t(
            coverage.missing === 1
              ? "instruments.coverage.missing.one"
              : "instruments.coverage.missing.other",
            { count: numberFormatter(locale).format(coverage.missing) },
          )}
        </Text>
      )}
      <HistoryNotice
        history={history}
        retrying={retry.isPending}
        onRetry={handleRetry}
      />
      <CoverageActions
        canLoad={loadable}
        canImport={quote !== null}
        canRecord={range.kind === "none"}
        onLoad={() => {
          setLoading(true);
        }}
        onImport={() => {
          setImporting(true);
        }}
        onRecord={onRecord}
      />
      {loading && (
        <HistoryDialog
          code={code}
          onDone={() => {
            setLoading(false);
          }}
          onCancel={() => {
            setLoading(false);
          }}
        />
      )}
      {importing && quote !== null && (
        <InstrumentPriceImportDialog
          code={code}
          quote={quote}
          onClose={() => {
            setImporting(false);
          }}
        />
      )}
    </Stack>
  );
}
