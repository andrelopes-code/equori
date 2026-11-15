import type { components } from "@/api/schema.gen";
import { CategorizeBody } from "@/features/assistant/proposal/categorize-body";
import { bodyKind } from "@/features/assistant/proposal/body-kind";
import { InvestmentBody } from "@/features/assistant/proposal/investment-body";
import { LimitBody } from "@/features/assistant/proposal/limit-body";
import { PaymentBody } from "@/features/assistant/proposal/payment-body";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { RecordBody } from "@/features/assistant/proposal/record-body";
import { RuleBody } from "@/features/assistant/proposal/rule-body";
import { ScheduleBody } from "@/features/assistant/proposal/schedule-body";
import { VoidBody } from "@/features/assistant/proposal/void-body";

type Preview = components["schemas"]["AssistantPreview"];

interface OperationBodyProps {
  preview: Preview;
}

// What a proposal does, drawn in the form of its kind (spec 2026-11-15, section 7). A kind the
// client does not know keeps the field rows.
export function OperationBody({ preview }: OperationBodyProps) {
  switch (bodyKind(preview.action)) {
    case "categorize":
      return <CategorizeBody preview={preview} />;
    case "rule":
      return <RuleBody preview={preview} />;
    case "void":
      return <VoidBody preview={preview} />;
    case "record":
      return <RecordBody preview={preview} />;
    case "schedule":
      return <ScheduleBody preview={preview} />;
    case "investment":
      return <InvestmentBody preview={preview} />;
    case "limit":
      return <LimitBody preview={preview} />;
    case "payment":
      return <PaymentBody preview={preview} />;
    case "fields":
      return <ProposalChanges changes={preview.changes} />;
  }
}
