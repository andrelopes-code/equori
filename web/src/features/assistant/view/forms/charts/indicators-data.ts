export interface IndicatorsData {
  month: string;
  tiles: {
    kind: "savings" | "committed" | "liquidity";
    bp: number;
    series: number[];
  }[];
}
