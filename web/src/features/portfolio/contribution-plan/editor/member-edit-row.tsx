import { MenuItem } from "@slotted/react/menu";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { LockToggle } from "@/features/portfolio/contribution-plan/editor/lock-toggle";
import { PercentField } from "@/features/portfolio/contribution-plan/editor/percent-field";
import { ReceivedAmount } from "@/features/portfolio/contribution-plan/editor/received-amount";
import { RowMenu } from "@/features/portfolio/contribution-plan/editor/row-menu";
import { TodayShare } from "@/features/portfolio/contribution-plan/editor/today-share";
import { TargetSlider } from "@/features/portfolio/contribution-plan/editor/target-slider";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { useT } from "@/i18n/i18n-provider";

type Member = components["schemas"]["ContributionMember"];

interface MemberEditRowProps {
  index: number;
  at: number;
  member: Member;
  name: string;
  edit: EditClass;
  editor: PlanEditor;
}

// An asset of a group, indented. It carries an ideal of its own only when the group is split.
export function MemberEditRow({
  index,
  at,
  member,
  name,
  edit,
  editor,
}: MemberEditRowProps) {
  const t = useT();

  const target = edit.split ? member.target_bp : undefined;
  const locked = edit.memberLocks[at] ?? false;
  const disabled = edit.memberLocks.every((l, i) => i === at || l);

  return (
    <div role="listitem" className={styles.row}>
      <Text size="md" className={styles.member}>
        {name}
      </Text>

      {target === undefined ? (
        <>
          <span />
          <span />
          <span />
        </>
      ) : (
        <>
          <TargetSlider
            name={name}
            value={target}
            disabled={disabled}
            onChange={(bp) => {
              editor.setMemberTarget(index, at, bp);
            }}
          />

          <PercentField
            name={name}
            value={target}
            disabled={disabled}
            onChange={(bp) => {
              editor.setMemberTarget(index, at, bp);
            }}
          />

          <LockToggle
            name={name}
            locked={locked}
            onLock={(next) => {
              editor.setMemberLocked(index, at, next);
            }}
          />
        </>
      )}

      <TodayShare bp={member.share_bp ?? 0} />

      <ReceivedAmount amount={member.amount} />

      <div className={styles.actions}>
        <RowMenu name={name}>
          <MenuItem
            tone="danger"
            onSelect={() => {
              editor.removeMember(index, at);
            }}
          >
            {t("contributionPlan.removeMember")}
          </MenuItem>
        </RowMenu>
      </div>
    </div>
  );
}
