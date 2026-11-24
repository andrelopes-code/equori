import type { GridColumn } from "@slotted/core/grid";

import { averageCostText } from "@/features/accounts";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { formatBasisPoints, formatDate } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";
import type { MoneyFormat } from "@/privacy/use-money-format";

export interface GridHolding extends Holding {
  group: string;
  accountName: string;
}

// PC7: what every reader needs shows first; the rest waits under the column manager.
export const defaultColumnState = {
  hidden: ["quantity", "averageCost", "cost", "price", "priceDate", "account"],
};

const amount = (value: unknown) => (typeof value === "number" ? value : 0);

// A group with no figure of a column draws nothing, not a zero: cash has no gain.
const sum = (values: readonly unknown[]) => {
  const numbers = values.filter((v) => typeof v === "number");

  return numbers.length === 0 ? null : numbers.reduce((a, b) => a + b, 0);
};

// The columns of the list. The group column stays out of sight: the group rows carry its words.
export function holdingsColumns({
  t,
  fmt,
  tag,
  scale,
  valueIn,
  showNet,
}: {
  t: TFunction;
  fmt: MoneyFormat;
  tag: string;
  scale: (code: string) => number;
  valueIn: string;
  showNet: boolean;
}): GridColumn<GridHolding>[] {
  const digits = scale(valueIn);
  const money = (value: unknown) =>
    value === null || value === undefined
      ? ""
      : fmt.money({ amount: amount(value), currency: valueIn }, digits);
  const signed = (value: unknown) =>
    value === null || value === undefined
      ? ""
      : fmt.signed({ amount: amount(value), currency: valueIn }, digits);
  const price = (h: GridHolding) =>
    units(h)?.prices?.find((p) => p.instrument === h.code);
  const oldest = (h: GridHolding) =>
    h.position?.prices?.map((p) => p.date).sort()[0];
  // FC13: a fixed income title holds units at 1.00 at issue; its quantity repeats its cost.
  const units = (h: GridHolding) =>
    h.type === "fixed_income" ? undefined : h.position;

  return [
    {
      id: "group",
      label: t("holdings.by"),
      accessor: "group",
      hideable: false,
    },
    {
      id: "name",
      label: t("positions.instrument"),
      accessor: "name",
      // An aggregate on this column would also be written in every group row, so the summary row
      // holds its figures with no label; the summary states their name.
      rowHeader: true,
      hideable: false,
      flex: 1,
      minWidth: 300,
    },
    {
      id: "trend",
      label: t("holdings.col.trend"),
      accessor: () => null,
      sortable: false,
      width: 160,
    },
    {
      id: "quantity",
      label: t("positions.quantity"),
      accessor: (h) => units(h)?.quantity.amount ?? null,
      kind: "number",
      numeric: true,
      width: 120,
      format: (_value, h) => {
        const p = units(h);

        return p === undefined
          ? ""
          : fmt.number(p.quantity, scale(p.quantity.currency));
      },
    },
    {
      id: "averageCost",
      label: t("positions.averageCost"),
      accessor: (h) => Number(units(h)?.average_cost ?? 0) || null,
      kind: "number",
      numeric: true,
      width: 130,
      format: (_value, h) => {
        const p = units(h);

        return p === undefined
          ? ""
          : averageCostText(
              fmt,
              p.average_cost,
              p.cost_basis.currency,
              scale(p.cost_basis.currency),
            );
      },
    },
    {
      id: "cost",
      label: t("positions.costBasis"),
      accessor: (h) => h.position?.cost_basis.amount ?? null,
      kind: "number",
      numeric: true,
      width: 130,
      format: (_value, h) =>
        h.position === undefined
          ? ""
          : fmt.money(
              h.position.cost_basis,
              scale(h.position.cost_basis.currency),
            ),
    },
    {
      id: "price",
      label: t("holdings.col.price"),
      accessor: (h) => Number(price(h)?.value ?? 0) || null,
      kind: "number",
      numeric: true,
      width: 120,
      format: (_value, h) => {
        const p = price(h);

        return p === undefined
          ? ""
          : averageCostText(
              fmt,
              p.value,
              p.quote_instrument,
              scale(p.quote_instrument),
            );
      },
    },
    {
      id: "priceDate",
      label: t("instruments.col.priceDate"),
      accessor: (h) => oldest(h) ?? "",
      width: 130,
      format: (value) =>
        typeof value === "string" && value !== "" ? formatDate(value, tag) : "",
    },
    {
      id: "account",
      label: t("portfolio.account"),
      accessor: "accountName",
      width: 240,
    },
    {
      id: "value",
      label: t("positions.marketValue"),
      accessor: (h) => h.value ?? null,
      kind: "number",
      numeric: true,
      width: 220,
      aggregate: sum,
      format: money,
    },
    ...(showNet
      ? [
          {
            id: "estimatedNet",
            label: t("portfolio.estimatedNet"),
            accessor: (h: GridHolding) =>
              h.position?.estimated_net?.amount ?? null,
            kind: "number" as const,
            numeric: true,
            width: 180,
            format: money,
          },
        ]
      : []),
    {
      id: "gain",
      label: t("positions.result"),
      accessor: (h) => h.gain ?? null,
      kind: "number",
      numeric: true,
      width: 220,
      aggregate: sum,
      format: signed,
    },
    {
      id: "total",
      label: t("holdings.total"),
      accessor: (h) => h.total ?? null,
      kind: "number",
      numeric: true,
      width: 180,
      aggregate: sum,
      format: signed,
    },
    {
      id: "share",
      label: t("portfolio.share"),
      accessor: (h) => h.share ?? null,
      kind: "number",
      numeric: true,
      width: 130,
      aggregate: sum,
      format: (value) =>
        value === null || value === undefined
          ? ""
          : formatBasisPoints(amount(value), tag),
    },
  ];
}
