import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/class-table.module.css";
import { DriftTrack } from "@/features/portfolio/contribution-plan/drift-track";
import { FigureCells } from "@/features/portfolio/contribution-plan/figure-cells";
import { TargetInput } from "@/features/portfolio/contribution-plan/target-input";
import { quantityOf } from "@/features/portfolio/contribution-plan/shopping-list";

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
    <TableRow value={rowKey} id={id} className={styles.row}>
      <TableCell />

      <TableRowHeader
        text="truncate"
        className={[styles.name, styles.member].join(" ")}
      >
        {name}
        {edit !== undefined && (
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={t("contributionPlan.removeAsset", { name })}
            onClick={edit.onRemove}
          >
            <Icon>
              <Glyph name="trash" />
            </Icon>
          </IconButton>
        )}
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
        targetCell={
          edit?.split === true && member.target_bp !== undefined ? (
            <TargetInput
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
    </TableRow>
  );
}
