import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { yieldLine } from "@/features/portfolio/yield-figures";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The days of the window, the 90 that end at the date of the balance sheet.
const WINDOW_DAYS = 90;

// Between the figure, the percent of the index and the day a late start begins from.
const SEPARATOR = "·";

interface AccountYieldProps {
  accountId: string;
  // The last day of the window: the date of the balance sheet.
  date: string;
  // A phone row: the figure alone, in the smaller size of its description line.
  compact?: boolean;
}

// The yield of an account over the 90 days of its balance trend, on one line (amendment A208
// R17, R21, R23): the figure, in the danger tone when negative, the index it is read against,
// the day the comparison starts when it starts late, or why there is no figure. The figures keep
// one line; a long reason wraps inside the cell. A phone row keeps the figure and the day.
export function AccountYield({
  accountId,
  date,
  compact = false,
}: AccountYieldProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const windowStart = shiftDate(date, 1 - WINDOW_DAYS);
  const report = useAccountYield(accountId, windowStart, date);

  const line =
    report === undefined ? undefined : yieldLine(report, t, tag, windowStart);
  if (line === undefined) return null;

  const size = compact ? "xs" : "sm";
  const secondary =
    compact && line.primary !== undefined ? undefined : line.secondary;
  const hasPrimary = line.primary !== undefined;
  const hasBefore = hasPrimary || secondary !== undefined;

  return (
    <Inline gap={2} justify="end">
      {line.primary !== undefined && (
        <Text
          size={size}
          tone={line.negative ? "danger" : "default"}
          numeric="tabular"
          wrap="nowrap"
        >
          {line.primary}
        </Text>
      )}

      {hasPrimary && secondary !== undefined && (
        <Text size={size} tone="muted" aria-hidden>
          {SEPARATOR}
        </Text>
      )}

      {secondary !== undefined && (
        <Text size={size} tone="muted" numeric="tabular">
          {secondary}
        </Text>
      )}

      {hasBefore && line.since !== undefined && (
        <Text size={size} tone="muted" aria-hidden>
          {SEPARATOR}
        </Text>
      )}

      {line.since !== undefined && (
        <Text size={size} tone="muted" numeric="tabular" wrap="nowrap">
          {line.since}
        </Text>
      )}
    </Inline>
  );
}
