import { codeText } from "@/api/problem";
import { useT } from "@/i18n/i18n-provider";
import type { BulkOutcome } from "@/ui/bulk-outcome";
import { FormNotice } from "@/ui/form-notice";

interface BulkOutcomeNoticeProps {
  outcome: BulkOutcome;
  summary: "bulk.resolved" | "bulk.voided";
  labelOf: (id: string) => string;
}

export function BulkOutcomeNotice({
  outcome,
  summary,
  labelOf,
}: BulkOutcomeNoticeProps) {
  const t = useT();

  const refusals = outcome.refused.map(({ id, status }) =>
    t("bulk.refusedLine", {
      label: labelOf(id),
      reason: codeText(status, status, t),
    }),
  );
  const text = [
    t(summary, { done: outcome.done, refused: outcome.refused.length }),
    ...refusals,
  ].join(" ");

  return (
    <FormNotice tone={outcome.refused.length === 0 ? "success" : "warning"}>
      {text}
    </FormNotice>
  );
}
