import type { components } from "@/api/schema.gen";
import { actionIcon } from "@/features/assistant/message/source-icon";
import type { AssistantIconName } from "@/features/assistant/panel/assistant-icon";
import { bodyKind } from "@/features/assistant/proposal/bodies/body-kind";
import { operationKind } from "@/features/assistant/proposal/ticket/operation-kind";

type Proposal = components["schemas"]["AssistantProposal"];

const KINDS = new Map<string, AssistantIconName>(
  Object.entries({
    buy: "buy",
    sell: "sell",
    note: "receipt",
    income: "coins",
    write_off: "minus",
    record_fixed_income: "bank",
    transfer_custody: "swap",
    split: "split",
    reverse_split: "split",
    bonus: "split",
    conversion: "split",
    spin_off: "split",
    right_issue: "split",
    unit_tax: "minus",
    right_exercise: "coins",
    capital_return: "coins",
  } satisfies Record<string, AssistantIconName>),
);

// The icon of a proposal: of what an investment operation records, else of its tool.
export function operationIcon({
  tool,
  preview,
}: Pick<Proposal, "tool" | "preview">): AssistantIconName {
  const { action } = preview;
  if (action === "record_investment.correct") return "pencil";
  if (bodyKind(action) !== "ticket") return actionIcon(tool);

  return KINDS.get(operationKind(preview)) ?? actionIcon(tool);
}
