import type { components } from "@/api/schema.gen";
import { recordStateWords } from "@/features/accounts/batch-records-table";
import type { MessageKey } from "@/i18n/catalog.en";

type ExternalRecord = components["schemas"]["ExternalRecord"];

// What a sync did with a line: its automatic decision, a bank change left to review, or its state.
export function recordOutcome(record: ExternalRecord): MessageKey {
  if (record.decision !== undefined) {
    return `links.decision.${record.decision}`;
  }

  if (record.review_reason === "changed") {
    return "links.outcome.changed";
  }

  return recordStateWords[record.state];
}
