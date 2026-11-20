import type { ViewMoney } from "@/features/assistant/view/view-types";

// The data of the ledger's forms, as internal/ledger/viewapi writes them.

export interface TxItem {
  id: string;
  date: string;
  name: string;
  account: string;
  category: string;
  amount: ViewMoney;
}

export interface TxsData {
  count: number;
  total: ViewMoney;
  average: ViewMoney;
  items: TxItem[];
}

export interface OutliersData {
  rows: {
    category: string;
    median: ViewMoney;
    points: { id: string; name: string; amount: ViewMoney; ratio_bp: number }[];
    outlier?: { id: string; name: string; amount: ViewMoney; ratio_bp: number };
  }[];
}

export interface HeatData {
  month: string;
  days: ViewMoney[];
  until: number;
  peak: number;
}

export interface TransactionData {
  item: TxItem;
  tags: string[];
  postings: { account: string; class: string; amount: ViewMoney }[];
  history: { version: number; reason?: string; at: string }[];
  attachments: { file_name: string; size: number }[];
}
