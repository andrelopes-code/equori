import type { components } from "@/api/schema.gen";

type Indicators = components["schemas"]["InstitutionIndicators"];
type Money = components["schemas"]["Money"];

export type IndicatorFigure =
  | {
      id: "basel" | "principalCapital" | "fixedAsset";
      kind: "ratio";
      // Null: the source does not inform the value. It is never read as zero.
      basisPoints: number | null;
    }
  | { id: "equity" | "netIncome"; kind: "amount"; money: Money | null };

// The five figures of an institution in the order the tab draws them.
export function indicatorFigures(x: Indicators): IndicatorFigure[] {
  return [
    { id: "basel", kind: "ratio", basisPoints: basisPoints(x.basel) },
    {
      id: "principalCapital",
      kind: "ratio",
      basisPoints: basisPoints(x.principal_capital),
    },
    {
      id: "fixedAsset",
      kind: "ratio",
      basisPoints: basisPoints(x.fixed_asset),
    },
    { id: "equity", kind: "amount", money: amount(x.equity, x.currency) },
    {
      id: "netIncome",
      kind: "amount",
      money: amount(x.net_income, x.currency),
    },
  ];
}

// A ratio is a decimal fraction text (0.155 is 15.5%); the screen writes two decimals.
function basisPoints(fraction: string | null): number | null {
  return fraction === null ? null : Math.round(Number(fraction) * 10000);
}

function amount(minor: number | null, currency: string): Money | null {
  return minor === null ? null : { amount: minor, currency };
}
