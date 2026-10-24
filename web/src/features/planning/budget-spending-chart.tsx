import { Chart } from "@slotted/react/chart";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface SpendingSlice {
  name: string;
  spent: number;
  // The category's colour, 1 to 8, so a group keeps the colour it has in the category tree.
  slot?: number;
}

// Where the month's spending went: one slice per top category with budgets, one for what no
// budget covers, and the total in the middle.
export function BudgetSpendingChart({
  slices,
  currency,
  scale,
  loading,
}: {
  slices: readonly SpendingSlice[];
  currency: string;
  scale: number;
  loading: boolean;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const money = (amount: number) => fmt.money({ amount, currency }, scale);
  const shown = slices.filter((s) => s.spent > 0);
  const total = shown.reduce((sum, s) => sum + s.spent, 0);
  return (
    <Chart
      variant="card"
      size="sm"
      legendValues
      legendOverflow="wrap"
      loading={loading}
      data={shown.map((s) => ({ ...s }))}
      series={[
        {
          kind: "pie",
          field: "spent",
          label: t("budget.spent"),
          innerRadius: 0.64,
          slotField: "slot",
          format: money,
        },
      ]}
      title={t("budget.spendingChart")}
      x={{ field: "name" }}
      renderCenter={() => (
        <Stack gap={0} align="center">
          <Text size="xs" tone="muted">
            {t("budget.spent")}
          </Text>
          <Text size="md" weight="semibold" numeric="tabular">
            {money(total)}
          </Text>
        </Stack>
      )}
    />
  );
}
