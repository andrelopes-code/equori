import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { GroupAssetsFooter } from "@/features/portfolio/contribution-plan/editor/group-assets-footer";
import { MemberDerivedRow } from "@/features/portfolio/contribution-plan/editor/member-derived-row";
import { MemberEditRow } from "@/features/portfolio/contribution-plan/editor/member-edit-row";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { MatchedRow } from "@/features/portfolio/contribution-plan/rules/matched-row";
import { RuleList } from "@/features/portfolio/contribution-plan/rules/rule-list";
import { RuleModeChoice } from "@/features/portfolio/contribution-plan/rules/rule-mode-choice";

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
  // Opens the board of the criteria of the group.
  onCriteria: () => void;
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
  onCriteria,
}: GroupAssetsPanelProps) {
  const asked = edit.byQuestions && edit.split;

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
          {group.members.map((member, at) =>
            asked ? (
              <MemberDerivedRow
                key={`group-${String(index)}-${String(at)}`}
                index={index}
                at={at}
                member={member}
                name={memberName(member)}
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

          <GroupAssetsFooter
            empty={group.members.length === 0}
            split={edit.split}
            criteria={edit.byQuestions ? edit.questions.length : 0}
            onSplit={(on) => {
              editor.setSplit(index, on);
            }}
            onCriteria={onCriteria}
            onAdd={onAddAsset}
          />
        </>
      )}
    </div>
  );
}
