import type { components } from "@/api/schema.gen";
import { TargetField } from "@/features/portfolio/contribution-plan/editor/target-field";
import { TargetSlider } from "@/features/portfolio/contribution-plan/editor/target-slider";
import { EntryOutcome } from "@/features/portfolio/contribution-plan/ideal/entry-outcome";
import { EntryStatus } from "@/features/portfolio/contribution-plan/ideal/entry-status";
import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";
import { NameCell } from "@/features/portfolio/contribution-plan/ideal/name-cell";
import { RemoveButton } from "@/features/portfolio/contribution-plan/ideal/remove-button";
import { ShareBar } from "@/features/portfolio/contribution-plan/ideal/share-bar";
import { positive } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { useT } from "@/i18n/i18n-provider";

type Member = components["schemas"]["ContributionMember"];

export interface MemberEdit {
  // Whether the group gives its members ideals of their own.
  split: boolean;
  locked: boolean;
  disabled: boolean;
  onTarget: (bp: number) => void;
  onLock: (locked: boolean) => void;
  onRemove: () => void;
}

interface MemberRowProps {
  id?: string;
  member: Member;
  name: string;
  position: number;
  hasAmount: boolean;
  waiting: boolean;
  edit?: MemberEdit | undefined;
}

// An asset of an open group, with its shares inside the group.
export function MemberRow({
  id,
  member,
  name,
  position,
  hasAmount,
  waiting,
  edit,
}: MemberRowProps) {
  const t = useT();

  const today = member.share_bp ?? 0;
  const after = positive(member.amount) ? member.after_share_bp : undefined;
  const target = edit?.split === true ? member.target_bp : undefined;

  return (
    <div
      role="listitem"
      id={id}
      className={[styles.row, styles.member].join(" ")}
    >
      <NameCell name={name} position={position} member />

      {edit !== undefined && target !== undefined ? (
        <TargetSlider
          name={name}
          value={target}
          disabled={edit.disabled}
          onChange={edit.onTarget}
        />
      ) : (
        <ShareBar
          name={name}
          today={today}
          after={after}
          ideal={member.target_bp}
          position={position}
        />
      )}

      {edit !== undefined && target !== undefined ? (
        <div className={styles.field}>
          <TargetField
            name={name}
            value={target}
            locked={edit.locked}
            disabled={edit.disabled}
            onChange={edit.onTarget}
            onLock={edit.onLock}
          />
        </div>
      ) : (
        <EntryStatus today={today} ideal={member.target_bp} member />
      )}

      {edit === undefined ? (
        <EntryOutcome
          amount={member.amount}
          hasAmount={hasAmount}
          waiting={waiting}
        />
      ) : (
        <RemoveButton
          label={t("contributionPlan.removeAsset", { name })}
          onRemove={edit.onRemove}
        />
      )}
    </div>
  );
}
