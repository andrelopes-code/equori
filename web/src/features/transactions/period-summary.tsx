import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { PeriodTotals } from "@/features/transactions/period-totals";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// Families read: stat-card, description-list. Three figures under a list's title are one line
// of the header, not three cards: each is a small label over its amount.
export function PeriodSummary({
  totals,
  scale,
}: {
  totals: PeriodTotals;
  scale: (code: string) => number;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const compact = useMediaQuery(compactQuery);
  const digits = scale(totals.currency);
  const money = (amount: number) =>
    fmt.money({ amount, currency: totals.currency }, digits);
  const figures = [
    {
      key: "income",
      label: t("transactions.summary.income"),
      text: money(totals.income),
      tone: "success" as const,
    },
    {
      key: "expense",
      label: t("transactions.summary.expense"),
      text: money(totals.expense),
      tone: "inherit" as const,
    },
    {
      key: "net",
      label: t("transactions.summary.net"),
      text: fmt.signed(
        { amount: totals.income + totals.expense, currency: totals.currency },
        digits,
      ),
      tone: "inherit" as const,
    },
  ];
  // On a phone the figures stay on one row, so the header leaves the records the first screen
  // (mobile.md M2).
  return (
    <Inline
      gap={compact ? 4 : 8}
      wrap={compact ? "nowrap" : "wrap"}
      justify={compact ? "between" : "start"}
      aria-label={t("transactions.summary.label")}
    >
      {figures.map((figure) => (
        <Stack key={figure.key} gap={1}>
          <Text size={compact ? "xs" : "sm"} tone="muted">
            {figure.label}
          </Text>
          <Text
            size={compact ? "md" : "lg"}
            weight="semibold"
            numeric="tabular"
            tone={figure.tone}
          >
            {figure.text}
          </Text>
        </Stack>
      ))}
    </Inline>
  );
}
