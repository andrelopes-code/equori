import type { components } from "@/api/schema.gen";
import { changeOf } from "@/features/assistant/proposal/preview-field";

type Preview = components["schemas"]["AssistantPreview"];

// What an investment proposal records: the side of a trade or of a note with one order, the kind a
// correction replaces, the corporate action, or the action itself.
export function operationKind(preview: Preview): string {
  const { action } = preview;

  if (action === "record_brokerage_note") {
    const [first, ...others] = preview.items ?? [];

    return others.length === 0 ? (first?.side ?? "note") : "note";
  }

  if (action === "record_investment.correct") {
    return changeOf(preview, "kind")?.after?.text ?? "correct";
  }

  return action.split(".")[1] ?? action;
}
