import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { amountVariance } from "@/features/planning/amount-variance";
import { useScale } from "@/features/setup";
import { formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Occurrence = components["schemas"]["Occurrence"];

interface OccurrenceReceivedProps {
  occurrence: Occurrence;
  income: boolean;
}

// What a realized occurrence actually moved, with its percent against the expected amount when
// the two differ; nothing for an occurrence without an actual amount.
export function OccurrenceReceived({
  occurrence,
  income,
}: OccurrenceReceivedProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const actual = occurrence.actual_amount;
  if (actual === undefined || scale === null) return null;

  const { bp, differs } = amountVariance(
    occurrence.expected_amount.amount,
    actual.amount,
  );
  const showPercent = differs && occurrence.expected_amount.amount !== 0;

  return (
    <Stack gap={0}>
      <Text size="xs" tone="muted">
        {t(income ? "occurrence.received" : "occurrence.paid", {
          amount: fmt.money(actual, scale(actual.currency)),
        })}
      </Text>
      {showPercent && (
        <Text size="xs" tone="muted">
          {t("occurrence.variance", {
            percent: formatSignedBasisPoints(bp, locale),
          })}
        </Text>
      )}
    </Stack>
  );
}
