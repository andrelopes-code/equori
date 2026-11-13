import { MenuCheckboxItem, MenuItem, MenuSeparator } from "@slotted/react/menu";

import type { components } from "@/api/schema.gen";
import { ClassNameInput } from "@/features/portfolio/contribution-plan/editor/class-name-input";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { LockToggle } from "@/features/portfolio/contribution-plan/editor/lock-toggle";
import { MemberEditRow } from "@/features/portfolio/contribution-plan/editor/member-edit-row";
import { PercentField } from "@/features/portfolio/contribution-plan/editor/percent-field";
import { ReceivedAmount } from "@/features/portfolio/contribution-plan/editor/received-amount";
import { RowMenu } from "@/features/portfolio/contribution-plan/editor/row-menu";
import { TodayShare } from "@/features/portfolio/contribution-plan/editor/today-share";
import { TargetSlider } from "@/features/portfolio/contribution-plan/editor/target-slider";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { useT } from "@/i18n/i18n-provider";

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
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onAddAsset: () => void;
}

// A group of the draft and, below it, its assets.
export function GroupEditRow({
  index,
  group,
  edit,
  disabled,
  editor,
  memberName,
  onAddAsset,
}: GroupEditRowProps) {
  const t = useT();

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

        <ReceivedAmount amount={group.amount} />

        <div className={styles.actions}>
          <RowMenu name={edit.name}>
            <MenuCheckboxItem
              checked={edit.split}
              onCheckedChange={(on) => {
                editor.setSplit(index, on);
              }}
            >
              {t("contributionPlan.split")}
            </MenuCheckboxItem>

            <MenuItem onSelect={onAddAsset}>
              {t("contributionPlan.addAsset")}
            </MenuItem>

            <MenuSeparator />

            <MenuItem
              tone="danger"
              onSelect={() => {
                editor.removeClass(index);
              }}
            >
              {t("contributionPlan.removeGroup")}
            </MenuItem>
          </RowMenu>
        </div>
      </div>

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
    </>
  );
}
