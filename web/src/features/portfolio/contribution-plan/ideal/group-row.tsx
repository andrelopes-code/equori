import type { components } from "@/api/schema.gen";
import { EntryOutcome } from "@/features/portfolio/contribution-plan/ideal/entry-outcome";
import { EntryStatus } from "@/features/portfolio/contribution-plan/ideal/entry-status";
import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";
import { MemberRow } from "@/features/portfolio/contribution-plan/ideal/member-row";
import { NameCell } from "@/features/portfolio/contribution-plan/ideal/name-cell";
import { ShareBar } from "@/features/portfolio/contribution-plan/ideal/share-bar";
import {
  groupCost,
  positive,
  unitsWaitForSplit,
} from "@/features/portfolio/contribution-plan/model/shopping-list";

type Group = components["schemas"]["ContributionClass"];

interface GroupRowProps {
  index: number;
  group: Group;
  open: boolean;
  hasAmount: boolean;
  waiting: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onToggle: () => void;
  onSplit: () => void;
}

// A group and, while it is open, its members.
export function GroupRow({
  index,
  group,
  open,
  hasAmount,
  waiting,
  memberName,
  onToggle,
  onSplit,
}: GroupRowProps) {
  const key = `group-${String(index)}`;
  const today = group.share_bp ?? 0;
  const after = positive(group.amount) ? group.after_share_bp : undefined;

  return (
    <>
      <div role="listitem" className={styles.row}>
        <NameCell
          name={group.name}
          position={index}
          {...(group.members.length > 0
            ? { expander: { open, controls: `${key}-0`, onToggle } }
            : {})}
        />

        <ShareBar
          name={group.name}
          today={today}
          after={after}
          ideal={group.target_bp}
          position={index}
        />

        <EntryStatus
          today={today}
          after={hasAmount && !waiting ? group.after_share_bp : undefined}
          ideal={group.target_bp}
          member={false}
        />

        <EntryOutcome
          amount={groupCost(group)}
          hasAmount={hasAmount}
          waiting={waiting}
          {...(unitsWaitForSplit(group) ? { onSplit } : {})}
        />
      </div>

      {open &&
        group.members.map((member, at) => (
          <MemberRow
            key={`${key}-${String(at)}`}
            id={`${key}-${String(at)}`}
            member={member}
            name={memberName(member)}
            position={index}
            hasAmount={hasAmount}
            waiting={waiting}
          />
        ))}
    </>
  );
}
