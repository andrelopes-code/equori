import type { ChartPoint } from "@slotted/core/chart";
import { Button } from "@slotted/react/button";
import { Chart } from "@slotted/react/chart";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories/category-paths";
import {
  childRows,
  type CompositionRow,
} from "@/features/categories/composition-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface CompositionChartProps {
  // The top-level groups of the month, ranked.
  rows: CompositionRow[];
  entries: readonly CategoryEntry[];
  items: readonly components["schemas"]["CategoryTotal"][] | undefined;
  currency: string;
  scale: number;
  loading: boolean;
}

// A click on a group that has children opens its composition; the button returns to the groups.
export function CompositionChart({
  rows,
  entries,
  items,
  currency,
  scale,
  loading,
}: CompositionChartProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const [drillId, setDrillId] = useState<string | null>(null);

  const group = rows.some((r) => r.id === drillId)
    ? entries.find((e) => e.id === drillId)
    : undefined;
  const shown =
    group === undefined
      ? rows
      : childRows(entries, items, group.id, t("category.chart.own"), locale);

  function handleSelect(point: ChartPoint | null) {
    const row = rows.find((r) => r.label === point?.key);
    if (
      group === undefined &&
      row &&
      entries.some((e) => e.parentId === row.id)
    ) {
      setDrillId(row.id);
    }
  }

  return (
    <Chart
      variant="card"
      size="sm"
      orientation="horizontal"
      loading={loading}
      data={shown}
      selectable={group === undefined}
      selection={null}
      onSelectionChange={handleSelect}
      series={[
        {
          id: "amount",
          kind: "bar",
          field: "amount",
          label: t("category.chart.amount"),
          format: (value) => fmt.money({ amount: value, currency }, scale),
        },
      ]}
      title={group?.name ?? t("category.chart.composition")}
      description={
        group === undefined ? t("category.chart.compositionHint") : undefined
      }
      actions={
        group !== undefined && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDrillId(null);
            }}
          >
            {t("category.chart.back")}
          </Button>
        )
      }
      x={{ field: "label" }}
      y={{
        format: (value) => fmt.money({ amount: value, currency }, scale),
      }}
    />
  );
}
