import type { ComponentType } from "react";

import type { AssistantIconName } from "@/features/assistant/panel/assistant-icon";
import { BudgetBody } from "@/features/assistant/view/forms/bars/budget-body";
import { ChangesBody } from "@/features/assistant/view/forms/bars/changes-body";
import { CompareBody } from "@/features/assistant/view/forms/bars/compare-body";
import { HelpBody } from "@/features/assistant/view/forms/help-body";
import { IndicatorsBody } from "@/features/assistant/view/forms/charts/indicators-body";
import { RankingBody } from "@/features/assistant/view/forms/bars/ranking-body";
import { SeriesBody } from "@/features/assistant/view/forms/charts/series-body";
import { TreemapBody } from "@/features/assistant/view/forms/charts/treemap-body";
import { WaterfallBody } from "@/features/assistant/view/forms/charts/waterfall-body";
import { HeatBody } from "@/features/assistant/view/forms/ledger/heat-body";
import { OutliersBody } from "@/features/assistant/view/forms/ledger/outliers-body";
import { TransactionBody } from "@/features/assistant/view/forms/ledger/transaction-body";
import { TxsBody } from "@/features/assistant/view/forms/ledger/txs-body";
import { AgendaBody } from "@/features/assistant/view/forms/planning/agenda-body";
import { BalanceBody } from "@/features/assistant/view/forms/planning/balance-body";
import { GoalsBody } from "@/features/assistant/view/forms/planning/goals-body";
import { RecurringBody } from "@/features/assistant/view/forms/planning/recurring-body";
import { AllocationBody } from "@/features/assistant/view/forms/portfolio/allocation-body";
import { BenchmarkBody } from "@/features/assistant/view/forms/portfolio/benchmark-body";
import { ContributionBody } from "@/features/assistant/view/forms/portfolio/contribution-body";
import { FigureBody } from "@/features/assistant/view/forms/portfolio/figure-body";
import { HoldingsBody } from "@/features/assistant/view/forms/portfolio/holdings-body";
import { TaxYearBody } from "@/features/assistant/view/forms/portfolio/tax-year-body";
import type { ViewWindow } from "@/features/assistant/view/view-types";

export type ViewUnit = "amount" | "share";

export interface FormBodyProps {
  data: unknown;
  unit: ViewUnit;
  // The period of the view, for the links of its rows.
  window: ViewWindow;
}

export interface ViewForm {
  icon: AssistantIconName;
  // The view switches between amounts and shares at its head.
  unit?: boolean;
  Body: ComponentType<FormBodyProps>;
}

// One entry per form the client draws (answer views design, V12). A form missing here draws its table.
export const FORMS: Partial<Record<string, ViewForm>> = {
  ranking: { icon: "pie", unit: true, Body: RankingBody },
  compare: { icon: "chart", Body: CompareBody },
  help: { icon: "book", Body: HelpBody },
  budget: { icon: "target", Body: BudgetBody },
  changes: { icon: "chart", Body: ChangesBody },
  treemap: { icon: "pie", Body: TreemapBody },
  series: { icon: "chart", Body: SeriesBody },
  waterfall: { icon: "chart", Body: WaterfallBody },
  indicators: { icon: "trend", Body: IndicatorsBody },
  txs: { icon: "search", Body: TxsBody },
  outliers: { icon: "search", Body: OutliersBody },
  heat: { icon: "calendar", Body: HeatBody },
  transaction: { icon: "receipt", Body: TransactionBody },
  agenda: { icon: "calendar", Body: AgendaBody },
  balance: { icon: "trend", Body: BalanceBody },
  goals: { icon: "target", Body: GoalsBody },
  recurring: { icon: "repeat", Body: RecurringBody },
  figure: { icon: "wallet", Body: FigureBody },
  allocation: { icon: "pie", unit: true, Body: AllocationBody },
  contribution: { icon: "pie", Body: ContributionBody },
  holdings: { icon: "chart", Body: HoldingsBody },
  benchmark: { icon: "trend", Body: BenchmarkBody },
  tax_year: { icon: "receipt", Body: TaxYearBody },
};
