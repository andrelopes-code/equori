import type { components } from "@/api/schema.gen";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { changeOf } from "@/features/assistant/proposal/preview-field";
import { actionTitle } from "@/features/assistant/proposal/proposal-card-state";
import { operationKind } from "@/features/assistant/proposal/ticket/operation-kind";
import type { TFunction } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

// The title of a proposal. An investment operation is named by what it records: the side of a note
// with one order, the type of an income, what a correction corrects (investment proposals design,
// IP10).
export function operationTitle(preview: Preview, t: TFunction): string {
  const { action } = preview;
  const kind = operationKind(preview);

  if (action === "record_brokerage_note") {
    return kind === "note"
      ? t("assistant.ticket.note", { count: preview.items?.length ?? 0 })
      : actionTitle(`record_investment.${kind}`, t);
  }

  if (action === "record_investment.correct") {
    const key = catalogKey(`assistant.ticket.correction.${kind}`);

    return key === undefined ? actionTitle(action, t) : t(key);
  }

  const type = changeOf(preview, "income_type")?.after?.text;
  if (type === undefined) return actionTitle(action, t);

  const label = catalogKey(`income.type.${type}`);

  return label === undefined ? type : t(label);
}
