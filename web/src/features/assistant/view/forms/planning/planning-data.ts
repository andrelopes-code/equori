import type { ViewMoney } from "@/features/assistant/view/view-types";

// The data of the planning forms, as internal/planning/toolapi writes them.

export interface AgendaData {
  total: ViewMoney;
  weeks: {
    start: string;
    total: ViewMoney;
    events: {
      date: string;
      description: string;
      account?: string;
      amount: ViewMoney;
      state: string;
    }[];
  }[];
}

export interface BalanceStep {
  date: string;
  description: string;
  amount: ViewMoney;
  balance: ViewMoney;
}

export interface BalanceData {
  account: string;
  from: string;
  to: string;
  opening: ViewMoney;
  points: BalanceStep[];
  low: BalanceStep;
}

export interface GoalsData {
  goals: {
    goal_id: string;
    name: string;
    target: ViewMoney;
    current: ViewMoney;
    progress_bp: number;
    due_on: string;
    months: number;
    monthly: ViewMoney;
  }[];
}

export interface RecurringData {
  total: ViewMoney;
  items: {
    key: string;
    name: string;
    account: string;
    frequency: string;
    last: ViewMoney;
    yearly: ViewMoney;
    scheduled: boolean;
  }[];
}
