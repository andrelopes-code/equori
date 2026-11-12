import {
  TableCell,
  TableExpander,
  TableRow,
  TableRowHeader,
  useTable,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/class-table.module.css";
import { DriftTrack } from "@/features/portfolio/contribution-plan/drift-track";
import { FigureCells } from "@/features/portfolio/contribution-plan/figure-cells";
import { MemberRow } from "@/features/portfolio/contribution-plan/member-row";
import { trackScale } from "@/features/portfolio/contribution-plan/track-scale";

type Class = components["schemas"]["ContributionClass"];

interface ClassRowProps {
  index: number;
  cls: Class;
  scale: number;
  open: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
}

// A class and, while it is open, its members.
export function ClassRow({
  index,
  cls,
  scale,
  open,
  memberName,
}: ClassRowProps) {
  const table = useTable();
  const key = `class-${String(index)}`;
  const memberScale = trackScale(
    cls.members.flatMap((m) => [m.target_bp, m.share_bp, m.after_share_bp]),
  );

  return (
    <>
      <TableRow value={key} className={styles.row}>
        <TableCell>{cls.members.length > 0 && <TableExpander />}</TableCell>

        <TableRowHeader text="truncate" className={styles.name}>
          {cls.name}
        </TableRowHeader>

        <TableCell>
          <DriftTrack
            name={cls.name}
            current={cls.share_bp}
            after={cls.after_share_bp}
            target={cls.target_bp}
            scale={scale}
            position={index}
          />
        </TableCell>

        <FigureCells
          target={cls.target_bp}
          current={cls.share_bp}
          after={cls.after_share_bp}
          amount={cls.amount}
        />
      </TableRow>

      {open &&
        cls.members.map((member, at) => (
          <MemberRow
            key={`${key}-${String(at)}`}
            rowKey={`${key}-${String(at)}`}
            {...(at === 0 ? { id: `${table.id}detail${key}` } : {})}
            member={member}
            name={memberName(member)}
            scale={memberScale}
            position={index}
          />
        ))}
    </>
  );
}
