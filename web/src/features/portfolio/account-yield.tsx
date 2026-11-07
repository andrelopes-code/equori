import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { yieldLine } from "@/features/portfolio/yield-figures";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The days of the window, the 90 that end at the date of the balance sheet.
const WINDOW_DAYS = 90;

// Between the parts of the second line, and between the figure and the day on a phone row.
const SEPARATOR = "·";

// Around the separator of a reason, which wraps: no break opportunity beside the separator.
const GLUED_SEPARATOR = "\u00A0·\u00A0";

interface AccountYieldProps {
  accountId: string;
  // The last day of the window: the date of the balance sheet.
  date: string;
  // A phone row: one line, in the smaller size of its description line.
  compact?: boolean;
}

// The yield of an account over the 90 days of its balance trend (amendment A208 R8, R17, R21,
// R23): two lines, right-aligned. The first is the figure, in the danger tone when negative. The
// second, muted, joins with a separator the index it is read against and the day a late start
// begins from, or states why there is no figure; only a reason wraps. A phone row keeps the figure
// and the day on one line that never wraps; a reason alone is truncated to one line, whole in the
// document.
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
  const tone = line.negative ? "danger" : "default";

  if (compact && line.primary === undefined) {
    return (
      <Text size={size} tone="muted" truncate>
        {line.secondary}
      </Text>
    );
  }

  if (compact) {
    return (
      <Inline gap={2} justify="end" wrap="nowrap">
        <Text size={size} tone={tone} numeric="tabular" wrap="nowrap">
          {line.primary}
        </Text>

        {line.since !== undefined && (
          <Text size={size} tone="muted" numeric="tabular" wrap="nowrap">
            {[SEPARATOR, line.since].join(" ")}
          </Text>
        )}
      </Inline>
    );
  }

  const separator = line.reason === true ? GLUED_SEPARATOR : ` ${SEPARATOR} `;
  const second = [line.secondary, line.since]
    .filter((part) => part !== undefined)
    .join(separator);

  return (
    <Stack gap={0} align="end">
      {line.primary !== undefined && (
        <Text size={size} tone={tone} numeric="tabular" wrap="nowrap">
          {line.primary}
        </Text>
      )}

      {second !== "" && (
        <Text
          size={size}
          tone="muted"
          numeric="tabular"
          wrap={line.reason === true ? undefined : "nowrap"}
        >
          {second}
        </Text>
      )}
    </Stack>
  );
}
