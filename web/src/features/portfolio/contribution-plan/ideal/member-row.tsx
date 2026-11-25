import type { components } from "@/api/schema.gen";
import { EntryOutcome } from "@/features/portfolio/contribution-plan/ideal/entry-outcome";
import { EntryStatus } from "@/features/portfolio/contribution-plan/ideal/entry-status";
import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";
import { NameCell } from "@/features/portfolio/contribution-plan/ideal/name-cell";
import { ShareBar } from "@/features/portfolio/contribution-plan/ideal/share-bar";
import { useReservedFor } from "@/features/portfolio/contribution-plan/ideal/use-reserved-for";
import { positive } from "@/features/portfolio/contribution-plan/model/shopping-list";

type Member = components["schemas"]["ContributionMember"];

interface MemberRowProps {
  id?: string;
  member: Member;
  name: string;
  position: number;
  hasAmount: boolean;
  waiting: boolean;
}

// An asset of an open group, with its shares inside the group.
export function MemberRow({
  id,
  member,
  name,
  position,
  hasAmount,
  waiting,
}: MemberRowProps) {
  const reserved = useReservedFor(member);
  const today = member.share_bp ?? 0;
  const after = positive(member.amount) ? member.after_share_bp : undefined;

  return (
    <div role="listitem" id={id} className={styles.row}>
      <NameCell name={name} position={position} reserved={reserved} />

      <ShareBar
        name={name}
        today={today}
        after={after}
        ideal={member.target_bp}
        position={position}
      />

      <EntryStatus
        today={today}
        after={hasAmount && !waiting ? member.after_share_bp : undefined}
        ideal={member.target_bp}
        member
      />

      <EntryOutcome
        amount={member.cost ?? member.amount}
        hasAmount={hasAmount}
        waiting={waiting}
        held={member.held === true}
      />
    </div>
  );
}
