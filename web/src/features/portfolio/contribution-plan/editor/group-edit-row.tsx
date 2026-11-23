import type { components } from "@/api/schema.gen";
import { ClassNameInput } from "@/features/portfolio/contribution-plan/editor/class-name-input";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { LockToggle } from "@/features/portfolio/contribution-plan/editor/lock-toggle";
import { GroupActions } from "@/features/portfolio/contribution-plan/editor/group-actions";
import { GroupAssetsPanel } from "@/features/portfolio/contribution-plan/editor/group-assets-panel";
import { PercentField } from "@/features/portfolio/contribution-plan/editor/percent-field";
import { ReceivedAmount } from "@/features/portfolio/contribution-plan/editor/received-amount";
import { TodayShare } from "@/features/portfolio/contribution-plan/editor/today-share";
import { TargetSlider } from "@/features/portfolio/contribution-plan/editor/target-slider";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { groupCost } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";

type Group = components["schemas"]["ContributionClass"];

interface GroupEditRowProps {
  index: number;
  // The row of the view at the same position: the figures.
  group: Group;
  // The row of the draft: what the reader typed.
  edit: EditClass;
  // True when every other group is locked.
  disabled: boolean;
  editor: PlanEditor;
  // Whether the assets panel of this group is open.
  open: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onToggle: () => void;
  onRemove: () => void;
  onAddAsset: () => void;
  onCriteria: () => void;
}

// A group of the draft and, below it, its assets.
export function GroupEditRow({
  index,
  group,
  edit,
  disabled,
  editor,
  open,
  memberName,
  onToggle,
  onRemove,
  onAddAsset,
  onCriteria,
}: GroupEditRowProps) {
  const panel = `group-assets-${String(index)}`;

  return (
    <>
      <div role="listitem" className={styles.row}>
        <div className={styles.name}>
          <GroupDot position={index} />

          <ClassNameInput
            value={edit.name}
            onChange={(name) => {
              editor.rename(index, name);
            }}
          />
        </div>

        <TargetSlider
          name={edit.name}
          value={edit.targetBp}
          disabled={disabled}
          onChange={(bp) => {
            editor.setTarget(index, bp);
          }}
        />

        <PercentField
          name={edit.name}
          value={edit.targetBp}
          disabled={disabled}
          onChange={(bp) => {
            editor.setTarget(index, bp);
          }}
        />

        <LockToggle
          name={edit.name}
          locked={edit.locked}
          onLock={(locked) => {
            editor.setLocked(index, locked);
          }}
        />

        <TodayShare bp={group.share_bp ?? 0} />

        <ReceivedAmount amount={groupCost(group)} />

        <GroupActions
          count={group.members.length}
          open={open}
          controls={panel}
          onToggle={onToggle}
          onRemove={onRemove}
        />
      </div>

      {open && (
        <GroupAssetsPanel
          id={panel}
          index={index}
          group={group}
          edit={edit}
          editor={editor}
          memberName={memberName}
          onAddAsset={onAddAsset}
          onCriteria={onCriteria}
        />
      )}
    </>
  );
}
