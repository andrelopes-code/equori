import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { GroupAssetsFooter } from "@/features/portfolio/contribution-plan/editor/group-assets-footer";
import { MemberEditRow } from "@/features/portfolio/contribution-plan/editor/member-edit-row";
import { MemberQuestionRow } from "@/features/portfolio/contribution-plan/editor/member-question-row";
import { MissingFactsNotice } from "@/features/portfolio/contribution-plan/editor/missing-facts-notice";
import { QuestionList } from "@/features/portfolio/contribution-plan/editor/question-list";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { withoutFacts } from "@/features/portfolio/contribution-plan/model/fact-answers";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { MatchedRow } from "@/features/portfolio/contribution-plan/rules/matched-row";
import { RuleList } from "@/features/portfolio/contribution-plan/rules/rule-list";
import { RuleModeChoice } from "@/features/portfolio/contribution-plan/rules/rule-mode-choice";
import { useT } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];

interface GroupAssetsPanelProps {
  id: string;
  index: number;
  // The row of the view at the same position: the figures.
  group: Group;
  // The row of the draft: what the reader typed.
  edit: EditClass;
  editor: PlanEditor;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onAddAsset: () => void;
}

// The assets of an open group, then the footer. Every row has a fixed height, so the rows below
// the panel move by the height of the panel alone.
export function GroupAssetsPanel({
  id,
  index,
  group,
  edit,
  editor,
  memberName,
  onAddAsset,
}: GroupAssetsPanelProps) {
  const t = useT();

  const asked = edit.byQuestions && edit.split;
  const noYes = asked && edit.questions.length > 0 && !group.question_ideals;
  const unanswered = asked
    ? withoutFacts(group.members, edit.questionFacts).map((at) =>
        memberName(group.members[at] ?? {}),
      )
    : [];

  function handleByQuestions(on: boolean) {
    const targets = group.question_ideals
      ? group.members.map((m) => m.target_bp ?? 0)
      : undefined;

    editor.setByQuestions(index, on, targets);
  }

  return (
    <div role="group" id={id} aria-label={edit.name} className={styles.panel}>
      <RuleModeChoice
        byRule={edit.byRule}
        members={edit.members.length}
        rules={edit.rules.length}
        onChange={(on) => {
          editor.setByRule(index, on);
        }}
      />

      {edit.byRule && <RuleList index={index} edit={edit} editor={editor} />}

      {edit.byRule &&
        group.matched.map((matched) => (
          <MatchedRow key={matched.instrument} matched={matched} />
        ))}

      {!edit.byRule && (
        <>
          {asked && (
            <QuestionList
              index={index}
              questions={edit.questions}
              facts={edit.questionFacts}
              editor={editor}
            />
          )}

          {group.members.map((member, at) =>
            asked ? (
              <MemberQuestionRow
                key={`group-${String(index)}-${String(at)}`}
                index={index}
                at={at}
                member={member}
                name={memberName(member)}
                questions={edit.questions}
                facts={edit.questionFacts}
                ideals={group.question_ideals}
                editor={editor}
              />
            ) : (
              <MemberEditRow
                key={`group-${String(index)}-${String(at)}`}
                index={index}
                at={at}
                member={member}
                name={memberName(member)}
                edit={edit}
                editor={editor}
              />
            ),
          )}

          <MissingFactsNotice names={unanswered} />

          {noYes && (
            <Text size="sm" tone="muted" className={styles.noYes}>
              {t("contributionPlan.questions.noYes")}
            </Text>
          )}

          <GroupAssetsFooter
            empty={group.members.length === 0}
            split={edit.split}
            byQuestions={edit.byQuestions}
            onSplit={(on) => {
              editor.setSplit(index, on);
            }}
            onByQuestions={handleByQuestions}
            onAdd={onAddAsset}
          />
        </>
      )}
    </div>
  );
}
