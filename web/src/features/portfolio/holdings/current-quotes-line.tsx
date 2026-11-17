import { Text } from "@slotted/react/typography";

import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import {
  currentQuotesSummary,
  currentQuotesText,
} from "@/features/portfolio/model/current-quote";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface CurrentQuotesLineProps {
  holdings: readonly Holding[];
}

// CQ29: how many holdings took a current quote, since which hour, and whether a session is open.
export function CurrentQuotesLine({ holdings }: CurrentQuotesLineProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const summary = currentQuotesSummary(holdings);

  if (summary === undefined) return null;

  return (
    <Text size="sm" tone="muted">
      {currentQuotesText(summary, t, tag)}
    </Text>
  );
}
