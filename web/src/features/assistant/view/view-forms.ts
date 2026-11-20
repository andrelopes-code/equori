import type { ComponentType } from "react";

import type { AssistantIconName } from "@/features/assistant/panel/assistant-icon";
import { BudgetBody } from "@/features/assistant/view/forms/budget-body";
import { CompareBody } from "@/features/assistant/view/forms/compare-body";
import { HelpBody } from "@/features/assistant/view/forms/help-body";
import { RankingBody } from "@/features/assistant/view/forms/ranking-body";
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
};
