import { piotroskiFacts } from "@/features/portfolio/contribution-plan/model/fact-answers";
import type { MessageKey } from "@/i18n/catalog.en";

export type LimitUnit = "times" | "percent" | "years" | "points";

export type CriterionGroup = "price" | "return" | "debt" | "history" | "market";

// The fact that reads the Crypto Fear & Greed Index, and the index it reads (CO17).
export const fearGreedFact = "crypto_fear_greed_max";
export const fearGreedIndex = "crypto_fear_greed";
export const fearGreedFeed = "alternative_me";

// The criteria a group holds at most.
export const maxQuestions = 20;

export interface LimitCriterion {
  key: string;
  group: CriterionGroup;
  label: MessageKey;
  meaning: MessageKey;
  unit: LimitUnit;
  // The limits the server accepts (AC10), in the unit of the figure: 12% is 0.12.
  least: number;
  greatest: number;
}

const multiple = { unit: "times", least: 0.01, greatest: 1000 } as const;
const rate = { unit: "percent", least: -1, greatest: 10 } as const;

// The criteria with a limit, in the order the panel lists them (AC10).
export const limitCriteria: readonly LimitCriterion[] = [
  {
    key: "price_earnings_max",
    group: "price",
    label: "contributionPlan.criteria.price_earnings_max",
    meaning: "contributionPlan.criteria.price_earnings_max.meaning",
    ...multiple,
  },
  {
    key: "price_book_max",
    group: "price",
    label: "contributionPlan.criteria.price_book_max",
    meaning: "contributionPlan.criteria.price_book_max.meaning",
    ...multiple,
  },
  {
    key: "roe_min",
    group: "return",
    label: "contributionPlan.criteria.roe_min",
    meaning: "contributionPlan.criteria.roe_min.meaning",
    ...rate,
  },
  {
    key: "net_margin_min",
    group: "return",
    label: "contributionPlan.criteria.net_margin_min",
    meaning: "contributionPlan.criteria.net_margin_min.meaning",
    ...rate,
  },
  {
    key: "gross_profit_assets_min",
    group: "return",
    label: "contributionPlan.criteria.gross_profit_assets_min",
    meaning: "contributionPlan.criteria.gross_profit_assets_min.meaning",
    ...rate,
  },
  {
    key: "net_debt_equity_max",
    group: "debt",
    label: "contributionPlan.criteria.net_debt_equity_max",
    meaning: "contributionPlan.criteria.net_debt_equity_max.meaning",
    unit: "times",
    least: -10,
    greatest: 100,
  },
  {
    key: "current_ratio_min",
    group: "debt",
    label: "contributionPlan.criteria.current_ratio_min",
    meaning: "contributionPlan.criteria.current_ratio_min.meaning",
    unit: "times",
    least: 0.01,
    greatest: 100,
  },
  {
    key: "revenue_growth_min",
    group: "history",
    label: "contributionPlan.criteria.revenue_growth_min",
    meaning: "contributionPlan.criteria.revenue_growth_min.meaning",
    ...rate,
  },
  {
    key: "positive_years_min",
    group: "history",
    label: "contributionPlan.criteria.positive_years_min",
    meaning: "contributionPlan.criteria.positive_years_min.meaning",
    unit: "years",
    least: 1,
    greatest: 5,
  },
  {
    key: fearGreedFact,
    group: "market",
    label: "contributionPlan.criteria.crypto_fear_greed_max",
    meaning: "contributionPlan.criteria.crypto_fear_greed_max.meaning",
    unit: "points",
    least: 0,
    greatest: 100,
  },
];

export const criterionGroups: readonly CriterionGroup[] = [
  "price",
  "return",
  "debt",
  "history",
  "market",
];

// The criterion a fact key names; undefined for a signal, an own criterion and an unknown key.
export function limitCriterion(fact: string): LimitCriterion | undefined {
  return limitCriteria.find((criterion) => criterion.key === fact);
}

export function isSignal(fact: string): boolean {
  return piotroskiFacts.includes(fact);
}
