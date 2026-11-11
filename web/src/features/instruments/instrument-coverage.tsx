import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { useRequestHistory } from "@/features/instruments/api";
import {
  coverageRange,
  historyState,
  quoteAge,
} from "@/features/instruments/coverage-line";
import { HistoryDialog } from "@/features/instruments/history-dialog";
import { InstrumentPriceImportDialog } from "@/features/instruments/instrument-price-import-dialog";
import { sourceLabel } from "@/features/instruments/instrument-labels";
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
      {coverage.stale && coverage.last !== null && (
        <Alert tone="warning">
          <AlertContent>
            <AlertDescription>
              {t("instruments.coverage.stale", {
                date: formatDate(coverage.last, locale),
              })}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {age !== null && (
        <Text tone="muted">
          {t("instruments.coverage.age", {
            age: formatRelativeDays(-age, locale),
          })}
        </Text>
      )}
      {history.kind === "loading" && (
        <Text tone="muted">
          {t("instruments.history.loading", {
            from: formatDate(history.from, locale),
          })}
        </Text>
      )}
      {history.kind === "failed" && (
        <Alert tone="danger">
          <AlertContent>
            <AlertDescription>
              {t("instruments.history.failed", {
                from: formatDate(history.from, locale),
                error: history.error,
              })}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <Inline gap={2}>
        {history.kind === "failed" && (
          <Button size="sm" onClick={handleRetry} loading={retry.isPending}>
            {t("instruments.history.retry")}
          </Button>
        )}
        {loadable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLoading(true);
            }}
          >
            {t("instruments.history.load")}
          </Button>
        )}
        {quote !== null && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setImporting(true);
            }}
          >
            {t("prices.import.one")}
          </Button>
        )}
        {range.kind === "none" && (
          <Button size="sm" variant="ghost" onClick={onRecord}>
            {t("instrument.price.record")}
          </Button>
        )}
      </Inline>
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
