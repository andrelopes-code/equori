import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/class-table.module.css";
import { DriftTrack } from "@/features/portfolio/contribution-plan/drift-track";
import { FigureCells } from "@/features/portfolio/contribution-plan/figure-cells";
import { quantityOf } from "@/features/portfolio/contribution-plan/shopping-list";

type Member = components["schemas"]["ContributionMember"];

interface MemberRowProps {
  rowKey: string;
  id?: string;
  member: Member;
  name: string;
  scale: number;
  position: number;
}

// The same columns as its class, with the share inside the class.
export function MemberRow({
  rowKey,
  id,
  member,
  name,
  scale,
  position,
}: MemberRowProps) {
  const quantity =
    member.amount && quantityOf(member.amount, member.unit_value);
  const units =
    quantity === undefined || member.amount === undefined
      ? undefined
      : { amount: quantity, currency: member.amount.currency };

  return (
    <TableRow value={rowKey} id={id} className={styles.row}>
      <TableCell />

      <TableRowHeader
        text="truncate"
        className={[styles.name, styles.member].join(" ")}
      >
        {name}
      </TableRowHeader>

      <TableCell>
        <DriftTrack
          name={name}
          current={member.share_bp}
          after={member.after_share_bp}
          target={member.target_bp}
          scale={scale}
          position={position}
        />
      </TableCell>

      <FigureCells
        target={member.target_bp}
        current={member.share_bp}
        after={member.after_share_bp}
        amount={member.amount}
        units={units}
      />
    </TableRow>
  );
}
