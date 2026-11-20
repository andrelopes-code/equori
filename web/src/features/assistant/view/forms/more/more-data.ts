import type { ViewMoney } from "@/features/assistant/view/view-types";

// The data of the remaining forms, as each module's builder writes it.

export interface StatementParts {
  purchases: ViewMoney;
  installments: ViewMoney;
  charges: ViewMoney;
  credits: ViewMoney;
  total: ViewMoney;
}

export interface StatementData {
  reference: string;
  parts: StatementParts;
  categories: {
    category_id: string;
    name: string;
    total: ViewMoney;
    share_bp: number;
  }[];
}

export interface StatementHistoryData {
  statements: { reference: string; parts: StatementParts }[];
}

export interface ExplainData {
  items: {
    transaction_id: string;
    method: string;
    rule_name?: string;
    decided_at: string;
  }[];
}

export interface CategorizationData {
  from: string;
  to: string;
  total: number;
  methods: { method: string; count: number; share_bp: number }[];
}

export interface RedemptionData {
  gross: ViewMoney;
  income_tax: ViewMoney;
  iof: ViewMoney;
  custody_fee: ViewMoney;
  net: ViewMoney;
}

export interface InstitutionData {
  name: string;
  period: string;
  source: string;
  rows: { kind: string; value_bp: number; limit_bp?: number }[];
}

export interface PriceData {
  points: { date: string; value: string }[];
  change_bp: number;
}

export interface ImportsData {
  batches: {
    batch_id: string;
    account: string;
    source: string;
    file_name?: string;
    started_at: string;
    created: number;
    matched: number;
    needs_review: number;
    ignored: number;
  }[];
  review: number;
}

export interface CalculatorData {
  title: string;
  path: string;
  inputs: { key: string; value: string }[];
}
