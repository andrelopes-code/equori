import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { GroupAssetsFooter } from "@/features/portfolio/contribution-plan/editor/group-assets-footer";
import { MemberEditRow } from "@/features/portfolio/contribution-plan/editor/member-edit-row";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";

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
  return (
    <div role="group" id={id} aria-label={edit.name} className={styles.panel}>
      {group.members.map((member, at) => (
        <MemberEditRow
          key={`group-${String(index)}-${String(at)}`}
          index={index}
          at={at}
          member={member}
          name={memberName(member)}
          edit={edit}
          editor={editor}
        />
      ))}

      <GroupAssetsFooter
        empty={group.members.length === 0}
        split={edit.split}
        onSplit={(on) => {
          editor.setSplit(index, on);
        }}
        onAdd={onAddAsset}
      />
    </div>
  );
}
