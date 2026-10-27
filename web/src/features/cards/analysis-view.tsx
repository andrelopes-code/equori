import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Parts = components["schemas"]["StatementParts"];

const parts = ["purchases", "installments", "charges", "credits"] as const;

// Rows of statement parts drawn as stacked bars, with the same numbers in a table as the
// reading for anyone the drawing does not serve.
export function AnalysisView({
  title,
  label,
  rows,
  orientation,
  scale,
}: {
  title: string;
  // The header of the first column: what each row is.
  label: string;
  rows: readonly (Parts & { key: string; name: string })[];
  orientation: "horizontal" | "vertical";
  scale: number;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const currency = rows[0]?.total.currency ?? "";
  const money = (value: number) =>
    fmt.money({ amount: value, currency }, scale);
  const data = rows.map((r) => ({
    name: r.name,
    purchases: r.purchases.amount,
    installments: r.installments.amount,
    charges: r.charges.amount,
    credits: r.credits.amount,
  }));
  const series: ChartSeries<
    "installments" | "name" | "charges" | "credits" | "purchases"
  >[] = parts.map((part) => ({
    id: part,
    kind: "bar",
    field: part,
    label: t(`analysis.${part}`),
    stack: "parts",
    format: money,
  }));
  return (
    <Stack gap={4}>
      <Chart
        variant="card"
        size="sm"
        orientation={orientation}
        title={title}
        data={data}
        series={series}
        x={{ field: "name" }}
        y={{ format: money }}
        trigger="item"
        toolbar="none"
      />
      <Table columns={6} variant="framed">
        <TableContent>
          <TableCaption>{title}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{label}</TableColumnHeader>
              {parts.map((part) => (
                <TableColumnHeader key={part} numeric>
                  {t(`analysis.${part}`)}
                </TableColumnHeader>
              ))}
              <TableColumnHeader numeric>
                {t("analysis.total")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableRowHeader>{r.name}</TableRowHeader>
                {parts.map((part) => (
                  <TableCell key={part} numeric>
                    {fmt.money(r[part], scale)}
                  </TableCell>
                ))}
                <TableCell numeric>{fmt.money(r.total, scale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableContent>
      </Table>
    </Stack>
  );
}
