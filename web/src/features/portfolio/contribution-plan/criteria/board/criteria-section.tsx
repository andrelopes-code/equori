import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTags,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { AddCriterionDialog } from "@/features/portfolio/contribution-plan/criteria/add/add-criterion-dialog";
import { CriteriaHelp } from "@/features/portfolio/contribution-plan/criteria/add/criteria-help";
import { BoardFoot } from "@/features/portfolio/contribution-plan/criteria/board/board-foot";
import { CriteriaBoard } from "@/features/portfolio/contribution-plan/criteria/board/criteria-board";
import { CriteriaEmpty } from "@/features/portfolio/contribution-plan/criteria/board/criteria-empty";
import { useCriteriaEdits } from "@/features/portfolio/contribution-plan/criteria/board/use-criteria-edits";
import type { BoardAsset } from "@/features/portfolio/contribution-plan/criteria/model/board-rows";
import {
  boardOf,
  equalShares,
} from "@/features/portfolio/contribution-plan/criteria/model/board-rows";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { CompanyReportDialog } from "@/features/portfolio/contribution-plan/month/company-report-dialog";
import { useCompanyFigures } from "@/features/portfolio/contribution-plan/month/use-company-figures";
import { StepGlyph } from "@/ui/navigation/step-glyph";
import { useT } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];

interface CriteriaSectionProps {
  index: number;
  edit: EditClass;
  // The class of the last preview.
  answered: Group | undefined;
  editor: PlanEditor;
  pending: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  // Back to the groups.
  onBack: () => void;
}

// The criteria of one group in edit mode, in place of the groups (spec, Criteria board).
export function CriteriaSection({
  index,
  edit,
  answered,
  editor,
  pending,
  memberName,
  onBack,
}: CriteriaSectionProps) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [opened, setOpened] = useState<string>();

  const { rows, assets } = boardOf(edit, answered, memberName);
  const targets = answered?.question_ideals
    ? answered.members.map((m) => m.target_bp ?? 0)
    : undefined;
  const edits = useCriteriaEdits({ index, edit, targets, editor });
  const companies = useCompanyFigures(
    assets.flatMap((a) => (a.instrument === undefined ? [] : [a.instrument])),
  );
  const unanswered = equalShares(assets);
  const noYes = rows.length > 0 && assets.every((a) => (a.points ?? 0) === 0);

  function openerOf({ instrument }: BoardAsset) {
    if (instrument === undefined || !companies.has(instrument)) {
      return undefined;
    }

    return () => {
      setOpened(instrument);
    };
  }

  return (
    <Section size="lg" ground="surface" heading="title" aria-busy={pending}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("contributionPlan.criteria.boardTitle", { name: edit.name })}
          </SectionHeading>

          <SectionTags>
            <CriteriaHelp />
          </SectionTags>

          <SectionDescription>
            {t("contributionPlan.criteria.rules")}
          </SectionDescription>
        </SectionTitle>

        <SectionActions>
          <Button
            variant="ghost"
            tone="secondary"
            start={<StepGlyph direction="previous" />}
            onClick={onBack}
          >
            {t("contributionPlan.criteria.back")}
          </Button>

          <Button
            variant="outline"
            tone="secondary"
            start={<Glyph name="plus" />}
            onClick={() => {
              setAdding(true);
            }}
          >
            {t("contributionPlan.criteria.add")}
          </Button>
        </SectionActions>
      </SectionHeader>

      <SectionBody>
        <Stack gap={4}>
          {rows.length === 0 && (
            <CriteriaEmpty
              onOwn={edits.addOwn}
              onPick={() => {
                setAdding(true);
              }}
            />
          )}

          {rows.length > 0 && (
            <CriteriaBoard
              index={index}
              name={edit.name}
              rows={rows}
              assets={assets}
              editor={editor}
              fresh={edits.fresh}
              onRemove={edits.remove}
              openerOf={openerOf}
            />
          )}

          {rows.length > 0 && (
            <BoardFoot
              noYes={noYes}
              unanswered={unanswered}
              name={edit.name}
              onClear={edits.clear}
            />
          )}
        </Stack>
      </SectionBody>

      {adding && (
        <AddCriterionDialog
          facts={edit.questionFacts}
          onOwn={() => {
            edits.addOwn();
            setAdding(false);
          }}
          onFacts={edits.addFacts}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}

      {opened !== undefined && (
        <CompanyReportDialog
          code={opened}
          open
          onClose={() => {
            setOpened(undefined);
          }}
        />
      )}
    </Section>
  );
}
