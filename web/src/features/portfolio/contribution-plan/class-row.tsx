import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  TableCell,
  TableExpander,
  TableRow,
  TableRowHeader,
  useTable,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { ClassEditRow } from "@/features/portfolio/contribution-plan/class-edit-row";
import { ClassNameInput } from "@/features/portfolio/contribution-plan/class-name-input";
import styles from "@/features/portfolio/contribution-plan/class-table.module.css";
import { DriftTrack } from "@/features/portfolio/contribution-plan/drift-track";
import { FigureCells } from "@/features/portfolio/contribution-plan/figure-cells";
import { MemberRow } from "@/features/portfolio/contribution-plan/member-row";
import { TargetInput } from "@/features/portfolio/contribution-plan/target-input";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/use-plan-editor";
import { trackScale } from "@/features/portfolio/contribution-plan/track-scale";
import { useT } from "@/i18n/i18n-provider";

type Class = components["schemas"]["ContributionClass"];

interface ClassRowProps {
  index: number;
  cls: Class;
  scale: number;
  open: boolean;
  editor?: PlanEditor | undefined;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
}

// A class and, while it is open, its members.
export function ClassRow({
  index,
  cls,
  scale,
  open,
  editor,
  memberName,
}: ClassRowProps) {
  const t = useT();
  const table = useTable();
  const key = `class-${String(index)}`;
  const draft = editor?.draft;
  const edit = draft?.classes[index];
  const blank = edit?.name.trim() === "";
  const memberScale = trackScale(
    cls.members.flatMap((m) => [m.target_bp, m.share_bp, m.after_share_bp]),
  );

  return (
    <>
      <TableRow value={key} className={styles.row}>
        <TableCell>
          {(cls.members.length > 0 || edit !== undefined) && <TableExpander />}
        </TableCell>

        <TableRowHeader text="truncate" className={styles.name}>
          {edit === undefined || editor === undefined ? (
            cls.name
          ) : (
            <>
              <ClassNameInput
                value={edit.name}
                onChange={(name) => {
                  editor.rename(index, name);
                }}
              />

              <IconButton
                size="sm"
                variant="ghost"
                aria-label={t("contributionPlan.removeClass", {
                  name: cls.name,
                })}
                onClick={() => {
                  editor.removeClass(index);
                }}
              >
                <Icon>
                  <Glyph name="trash" />
                </Icon>
              </IconButton>
            </>
          )}
        </TableRowHeader>

        <TableCell>
          {blank && (
            <Text tone="danger" size="xs">
              {t("contributionPlan.nameRequired")}
            </Text>
          )}

          {!blank && (
            <DriftTrack
              name={cls.name}
              current={cls.share_bp}
              after={cls.after_share_bp}
              target={cls.target_bp}
              scale={scale}
              position={index}
            />
          )}
        </TableCell>

        <FigureCells
          target={cls.target_bp}
          current={cls.share_bp}
          after={cls.after_share_bp}
          amount={cls.amount}
          targetCell={
            edit !== undefined && editor !== undefined ? (
              <TargetInput
                name={cls.name}
                value={cls.target_bp}
                locked={edit.locked}
                disabled={(draft?.classes ?? []).every(
                  (c, i) => i === index || c.locked,
                )}
                onChange={(bp) => {
                  editor.setTarget(index, bp);
                }}
                onLock={(locked) => {
                  editor.setLocked(index, locked);
                }}
              />
            ) : undefined
          }
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
            edit={memberEdit(editor, index, at)}
          />
        ))}

      {open && editor !== undefined && edit !== undefined && (
        <ClassEditRow index={index} editor={editor} />
      )}
    </>
  );
}

function memberEdit(editor: PlanEditor | undefined, index: number, at: number) {
  const cls = editor?.draft?.classes[index];
  if (editor === undefined || cls === undefined) return undefined;

  return {
    split: cls.split,
    locked: cls.memberLocks[at] ?? false,
    disabled: cls.memberLocks.every((l, i) => i === at || l),
    onTarget: (bp: number) => {
      editor.setMemberTarget(index, at, bp);
    },
    onLock: (locked: boolean) => {
      editor.setMemberLocked(index, at, locked);
    },
    onRemove: () => {
      editor.removeMember(index, at);
    },
  };
}
