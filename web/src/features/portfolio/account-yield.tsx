import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { indexName } from "@/features/calculators";
import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { formatBasisPoints, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AccountYieldProps {
  accountId: string;
  // The last day of the window: the date of the balance sheet.
  date: string;
  // A phone row: the rate alone, in the smaller size of its description line.
  compact?: boolean;
}

// The yield of an account over the 90 days of its balance trend, on one line: the rate a year
// on the index's basis, or the return of the period without one, then the percent of the index
// (amendment A208 R8).
export function AccountYield({
  accountId,
  date,
  compact = false,
}: AccountYieldProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const report = useAccountYield(accountId, shiftDate(date, -89), date);

  const benchmark = report?.benchmark;
  const annual = benchmark?.annual_bp;
  const period = report?.period_bp;
  const percent = benchmark?.percent_bp;
  if (annual === undefined && period === undefined) return null;

  return (
    <Inline gap={2} justify="end" wrap="nowrap">
      <Text size={compact ? "xs" : "sm"} numeric="tabular">
        {annual !== undefined &&
          t("portfolio.yield.annual", { rate: formatBasisPoints(annual, tag) })}
        {annual === undefined &&
          period !== undefined &&
          t("portfolio.yield.period", { rate: formatBasisPoints(period, tag) })}
      </Text>
      {!compact && benchmark !== undefined && percent !== undefined && (
        <Text size="sm" tone="muted" numeric="tabular">
          {t("portfolio.yield.ofIndex", {
            percent: formatBasisPoints(percent, tag),
            index: indexName(benchmark.index),
          })}
        </Text>
      )}
    </Inline>
  );
}
