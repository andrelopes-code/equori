import { Field, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { PriceChart } from "@/features/instruments/price-chart/price-chart";
import type { PriceSeries } from "@/features/instruments/price-import/price-series";
import {
  maxPrices,
  type SeriesChoice,
} from "@/features/instruments/price-import/use-price-series-import";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormRow } from "@/ui/form-row";

type Counts = components["schemas"]["InstrumentPricesResult"];

interface PriceSeriesPreviewProps {
  code: string;
  quote: string;
  series: PriceSeries;
  counts: Counts | undefined;
  onChoice: (choice: SeriesChoice) => void;
}

const shownSkipped = 5;

// What the browser read from the text: the columns, the quotes, the lines it left out and, once the
// server has answered the dry run, what a record would change.
export function PriceSeriesPreview({
  code,
  quote,
  series,
  counts,
  onChoice,
}: PriceSeriesPreviewProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const format = numberFormatter(locale);
  const choices = series.columns.map((column) => ({
    value: column,
    label: column,
  }));
  const prices = series.prices.map((p) => ({
    instrument: code,
    quote_instrument: quote,
    date: p.date,
    value: p.value,
    source: "csv",
  }));
  const read = series.prices.length;
  const skipped = series.skipped.length;

  return (
    <Stack gap={3}>
      <Text size="sm" tone="muted">
        {t("prices.import.preview.columns", {
          columns: series.columns.join(", "),
        })}
      </Text>
      <FormRow>
        <Field necessity="none">
          <FieldLabel>{t("prices.import.preview.date")}</FieldLabel>
          <ChoiceSelect
            label={t("prices.import.preview.date")}
            choices={choices}
            value={series.dateColumn}
            multiple={false}
            onChange={(next) => {
              if (typeof next === "string") onChoice({ dateColumn: next });
            }}
          />
        </Field>
        <Field necessity="none">
          <FieldLabel>{t("prices.import.preview.value")}</FieldLabel>
          <ChoiceSelect
            label={t("prices.import.preview.value")}
            choices={choices}
            value={series.valueColumn}
            multiple={false}
            onChange={(next) => {
              if (typeof next === "string") onChoice({ valueColumn: next });
            }}
          />
        </Field>
      </FormRow>
      {read === 0 && (
        <Text size="sm" tone="muted">
          {t("prices.import.preview.none")}
        </Text>
      )}
      {read > maxPrices && (
        <Text size="sm" tone="muted">
          {t("prices.import.preview.tooMany", {
            max: format.format(maxPrices),
          })}
        </Text>
      )}
      {read > 0 && read <= maxPrices && (
        <PriceChart prices={prices} quote={quote} loading={false} />
      )}
      {read > 0 && (
        <Text size="sm" tone="muted">
          {t(
            read === 1
              ? "prices.import.preview.read.one"
              : "prices.import.preview.read.other",
            { count: format.format(read) },
          )}
        </Text>
      )}
      {skipped > 0 && (
        <Stack gap={1}>
          <Text size="sm" tone="muted">
            {t(
              skipped === 1
                ? "prices.import.preview.skipped.one"
                : "prices.import.preview.skipped.other",
              { count: format.format(skipped) },
            )}
          </Text>
          {series.skipped.slice(0, shownSkipped).map((line) => (
            <Text key={line.line} size="sm" tone="muted">
              {t("prices.import.preview.skippedLine", {
                line: format.format(line.line),
                text: line.text,
              })}
            </Text>
          ))}
        </Stack>
      )}
      {counts !== undefined && (
        <Text size="sm" tone="muted">
          {t("prices.import.preview.counts", {
            new: format.format(counts.new),
            replaced: format.format(counts.replaced),
            unchanged: format.format(counts.unchanged),
          })}
        </Text>
      )}
      {counts !== undefined && counts.below_feed > 0 && (
        <Text size="sm" tone="muted">
          {t(
            counts.below_feed === 1
              ? "prices.import.preview.belowFeed.one"
              : "prices.import.preview.belowFeed.other",
            { count: format.format(counts.below_feed) },
          )}
        </Text>
      )}
    </Stack>
  );
}
