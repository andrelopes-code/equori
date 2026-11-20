import type { components } from "@/api/schema.gen";
import { CategorizeBody } from "@/features/assistant/proposal/bodies/categorize-body";
import { bodyKind } from "@/features/assistant/proposal/bodies/body-kind";
import { DiffRows } from "@/features/assistant/proposal/bodies/diff-rows";
import { FileBody } from "@/features/assistant/proposal/bodies/file-body";
import { GoalBody } from "@/features/assistant/proposal/bodies/goal-body";
import { InvestmentBody } from "@/features/assistant/proposal/bodies/investment-body";
import { LimitBody } from "@/features/assistant/proposal/bodies/limit-body";
import { MoveBody } from "@/features/assistant/proposal/bodies/move-body";
import { PaymentBody } from "@/features/assistant/proposal/bodies/payment-body";
import { PlanBody } from "@/features/assistant/proposal/bodies/plan-body";
import { RecordBody } from "@/features/assistant/proposal/bodies/record-body";
import { RuleBody } from "@/features/assistant/proposal/bodies/rule-body";
import { ScheduleBody } from "@/features/assistant/proposal/bodies/schedule-body";
import { VoidBody } from "@/features/assistant/proposal/bodies/void-body";

type Preview = components["schemas"]["AssistantPreview"];

interface OperationBodyProps {
  preview: Preview;
}

// What a proposal does, drawn in the form of its kind (spec 2026-11-15, section 7). A kind the
// client does not know draws its changes as before → after rows.
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
    case "file":
      return <FileBody preview={preview} />;
    case "goal":
      return <GoalBody preview={preview} />;
    case "budget":
      return <PlanBody preview={preview} kind="budget" />;
    case "application":
      return <PlanBody preview={preview} kind="application" />;
    case "move":
      return <MoveBody preview={preview} />;
    case "fields":
      return <DiffRows changes={preview.changes} />;
  }
}
