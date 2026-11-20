import type { ViewMoney } from "@/features/assistant/view/view-types";

// The data of the portfolio forms, as internal/portfolio/toolapi writes them.

export interface FigureData {
  net: ViewMoney;
  assets: ViewMoney;
  liabilities: ViewMoney;
  series: { date: string; net: ViewMoney }[] | null;
  change?: ViewMoney;
}

export interface AllocationData {
  total: ViewMoney;
  groups: { key: string; value: ViewMoney; share_bp: number }[];
}

export interface ContributionData {
  amount: ViewMoney;
  total: ViewMoney;
  classes: {
    name: string;
    target_bp: number;
    share_bp: number;
    after_bp: number;
    amount: ViewMoney;
  }[];
}

export interface HoldingsData {
  rows: {
    account: string;
    instrument: string;
    quantity: string;
    cost: ViewMoney;
    value: ViewMoney;
    result_bp: number;
    weight_bp: number;
  }[];
  cost: ViewMoney;
  value: ViewMoney;
  result_bp: number;
}

export interface BenchmarkData {
  index: string;
  from: string;
  until: string;
  return_bp: number;
  index_bp: number;
  excess_bp: number;
}

export interface TaxYearData {
  from: string;
  to: string;
  months: {
    month: string;
    result: ViewMoney;
    exempt: ViewMoney;
    tax: ViewMoney;
    due: ViewMoney;
  }[];
  total: ViewMoney;
}
