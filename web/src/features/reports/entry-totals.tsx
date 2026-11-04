import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { entryTotals, type EntryRow } from "@/features/reports/net-worth-days";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface EntryTotalsProps {
  rows: readonly EntryRow[];
  currency: string;
  digits: number;
}

// The income, the expenses and their result over the entries the table lists, each in the tone
// of its effect on net worth; the sign stays in the text, so the color is never the only cue.
export function EntryTotals({ rows, currency, digits }: EntryTotalsProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const totals = entryTotals(rows);
  const figures = [
    {
      key: "income",
      label: t("report.netWorth.income"),
      amount: totals.income,
    },
    {
      key: "expense",
      label: t("report.netWorth.expense"),
      amount: -totals.expense,
    },
    { key: "result", label: t("report.netWorth.result"), amount: totals.net },
  ];

  return (
    <Inline gap={6} wrap="wrap">
      {figures.map((figure) => (
        <Stack key={figure.key} gap={0}>
          <Text size="xs" tone="muted">
            {figure.label}
          </Text>
          <Text size="md" weight="semibold" tone={toneOf(figure.amount)}>
            {fmt.signed({ amount: figure.amount, currency }, digits)}
          </Text>
        </Stack>
      ))}
    </Inline>
  );
}

function toneOf(amount: number): "success" | "danger" | "muted" {
  if (amount > 0) return "success";

  return amount < 0 ? "danger" : "muted";
}
