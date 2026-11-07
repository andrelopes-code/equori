import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { yieldLine } from "@/features/portfolio/yield-figures";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AccountYieldProps {
  accountId: string;
  // The last day of the window: the date of the balance sheet.
  date: string;
  // A phone row: the figure alone, in the smaller size of its description line.
  compact?: boolean;
}

// The yield of an account over the 90 days of its balance trend, on one line (amendment A208
// R17): the figure, in the danger tone when negative, then the index it is read against.
export function AccountYield({
  accountId,
  date,
  compact = false,
}: AccountYieldProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const windowStart = shiftDate(date, -89);
  const report = useAccountYield(accountId, windowStart, date);

  const line =
    report === undefined ? undefined : yieldLine(report, t, tag, windowStart);
  if (line === undefined) return null;

  return (
    <Inline gap={2} justify="end" wrap="nowrap">
      <Text
        size={compact ? "xs" : "sm"}
        tone={line.negative ? "danger" : "default"}
        numeric="tabular"
      >
        {line.primary}
      </Text>
      {!compact && line.secondary !== undefined && (
        <Text size="sm" tone="muted" numeric="tabular">
          {line.secondary}
        </Text>
      )}
    </Inline>
  );
}
