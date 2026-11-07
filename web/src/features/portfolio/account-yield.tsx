import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { yieldLine } from "@/features/portfolio/yield-figures";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The days of the window, the 90 that end at the date of the balance sheet.
const WINDOW_DAYS = 90;

interface AccountYieldProps {
  accountId: string;
  // The last day of the window: the date of the balance sheet.
  date: string;
  // A phone row: the figure alone, in the smaller size of its description line.
  compact?: boolean;
}

// The yield of an account over the 90 days of its balance trend, on one line (amendment A208
// R17, R21, R23): the figure, in the danger tone when negative, the index it is read against,
// the days compared, or why there is no figure. The figures keep one line; a long reason wraps
// inside the cell.
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
    report === undefined ? undefined : yieldLine(report, t, tag, WINDOW_DAYS);
  if (line === undefined) return null;

  const size = compact ? "xs" : "sm";

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

      {(!compact || line.primary === undefined) &&
        line.secondary !== undefined && (
          <Text size={size} tone="muted" numeric="tabular">
            {line.secondary}
          </Text>
        )}

      {line.days !== undefined && (
        <Text size={size} tone="muted" numeric="tabular" wrap="nowrap">
          {line.days}
        </Text>
      )}
    </Inline>
  );
}
