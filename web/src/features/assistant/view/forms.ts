import type { ComponentType } from "react";

import type { AssistantIconName } from "@/features/assistant/panel/assistant-icon";

export type ViewUnit = "amount" | "share";

export interface FormBodyProps {
  data: unknown;
  unit: ViewUnit;
}

export interface ViewForm {
  icon: AssistantIconName;
  // The view switches between amounts and shares at its head.
  unit?: boolean;
  Body: ComponentType<FormBodyProps>;
}

// One entry per form the client draws (answer views design, V12). A form missing here draws its table.
export const FORMS: Partial<Record<string, ViewForm>> = {};
