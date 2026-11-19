import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { BreakEvenItem } from "@/features/calculators/indexer-comparison/break-even/break-even-items";
import { isOlderThan } from "@/features/calculators/indexer-comparison/comparison-dates";
import type { Security } from "@/features/calculators/indexer-comparison/security";
import { securityText } from "@/features/calculators/indexer-comparison/security-text";
import { formatRate } from "@/features/calculators/model/format-rate";
import { indexName } from "@/features/calculators/rate-source/index-catalog";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// A survey of expectations older than this many days is outdated (ADR 025).
const staleSurveyDays = 11;
// A curve older than this many days is outdated.
const staleCurveDays = 6;

interface BreakEvenRowProps {
  item: BreakEvenItem;
  security: Security;
  reference: Security;
}

// IC4, IC5, IC13: the break-even of one floating security against the reference, then the
// expected rate and the market rate it is read against, one line each. A missing figure is
// written in words; an outdated source is written in words in the warning colour.
export function BreakEvenRow({ item, security, reference }: BreakEvenRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const rate = (value: number) => formatRate(value, locale, { min: 2, max: 2 });
  const names = {
    security: securityText(security, t, locale),
    reference: securityText(reference, t, locale),
  };
  const staleSurvey =
    item.expected !== null &&
    isOlderThan(item.surveyDate, today, staleSurveyDays);
  const staleCurve =
    item.market !== null &&
    isOlderThan(item.market.date, today, staleCurveDays);

  return (
    <Stack gap={1}>
      <Text size="sm" truncate>
        {item.breakEven === null
          ? t("calc.indexerComparison.breakEven.none", names)
          : t("calc.indexerComparison.breakEven", {
              ...names,
              index: indexName(item.index),
              rate: rate(item.breakEven),
            })}
      </Text>

      <Inline gap={2} wrap="nowrap">
        <Text size="sm" tone="muted" truncate>
          {item.expected === null
            ? t("calc.indexerComparison.expected.none")
            : t("calc.indexerComparison.expected", {
                rate: rate(item.expected),
                date: formatDate(item.surveyDate, locale),
              })}
        </Text>
        {staleSurvey && (
          <Text size="sm" tone="warning">
            {t("calc.indexerComparison.stale.survey")}
          </Text>
        )}
      </Inline>

      <Inline gap={2} wrap="nowrap">
        <Text size="sm" tone="muted" truncate>
          {item.market === null
            ? t("calc.indexerComparison.market.none")
            : t(
                item.implied
                  ? "calc.indexerComparison.market.implied"
                  : "calc.indexerComparison.market",
                {
                  rate: rate(item.market.rate),
                  date: formatDate(item.market.date, locale),
                },
              )}
        </Text>
        {staleCurve && (
          <Text size="sm" tone="warning">
            {t("calc.indexerComparison.stale.curve")}
          </Text>
        )}
      </Inline>
    </Stack>
  );
}
