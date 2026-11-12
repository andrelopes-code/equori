import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/table/class-table.module.css";
import { FigureCells } from "@/features/portfolio/contribution-plan/table/figure-cells";
import { RemoveCell } from "@/features/portfolio/contribution-plan/table/remove-cell";
import { TargetField } from "@/features/portfolio/contribution-plan/table/target-field";
import { TrackCell } from "@/features/portfolio/contribution-plan/table/track-cell";
import { quantityOf } from "@/features/portfolio/contribution-plan/model/shopping-list";

import { useT } from "@/i18n/i18n-provider";

type Member = components["schemas"]["ContributionMember"];

export interface MemberEdit {
  // Whether the class gives its members targets of their own.
  split: boolean;
  locked: boolean;
  disabled: boolean;
  onTarget: (bp: number) => void;
  onLock: (locked: boolean) => void;
  onRemove: () => void;
}

interface MemberRowProps {
  rowKey: string;
  id?: string;
  member: Member;
  name: string;
  scale: number;
  position: number;
  edit?: MemberEdit | undefined;
}

// The same columns as its class, with the share inside the class.
export function MemberRow({
  rowKey,
  id,
  member,
  name,
  scale,
  position,
  edit,
}: MemberRowProps) {
  const t = useT();
  const quantity =
    member.amount && quantityOf(member.amount, member.unit_value);
  const units =
    quantity === undefined || member.amount === undefined
      ? undefined
      : { amount: quantity, currency: member.amount.currency };

  return (
    <TableRow
      value={rowKey}
      id={id}
      className={edit === undefined ? styles.row : styles.rowEdit}
    >
      <TableCell />

      <TableRowHeader text="truncate" className={styles.member}>
        {name}
      </TableRowHeader>

      <TrackCell
        name={name}
        current={member.share_bp}
        after={member.after_share_bp}
        target={member.target_bp}
        scale={scale}
        position={position}
        slider={
          edit?.split === true
            ? { disabled: edit.disabled, onChange: edit.onTarget }
            : undefined
        }
      />

      <FigureCells
        target={member.target_bp}
        current={member.share_bp}
        after={member.after_share_bp}
        amount={member.amount}
        units={units}
        targetCell={
          edit?.split === true && member.target_bp !== undefined ? (
            <TargetField
              name={name}
              value={member.target_bp}
              locked={edit.locked}
              disabled={edit.disabled}
              onChange={edit.onTarget}
              onLock={edit.onLock}
            />
          ) : undefined
        }
      />

      {edit !== undefined && (
        <RemoveCell
          label={t("contributionPlan.removeAsset", { name })}
          onRemove={edit.onRemove}
        />
      )}
    </TableRow>
  );
}
