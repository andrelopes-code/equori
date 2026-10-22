import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { PeriodTotals } from "@/features/transactions/period-totals";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

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
  return (
    <Inline gap={8} wrap="wrap" aria-label={t("transactions.summary.label")}>
      {figures.map((figure) => (
        <Stack key={figure.key} gap={1}>
          <Text size="sm" tone="muted">
            {figure.label}
          </Text>
          <Text
            size="lg"
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
