import type { components } from "@/api/schema.gen";
import { ClassEditRow } from "@/features/portfolio/contribution-plan/editor/class-edit-row";
import { TargetField } from "@/features/portfolio/contribution-plan/editor/target-field";
import { TargetSlider } from "@/features/portfolio/contribution-plan/editor/target-slider";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { EntryOutcome } from "@/features/portfolio/contribution-plan/ideal/entry-outcome";
import { EntryStatus } from "@/features/portfolio/contribution-plan/ideal/entry-status";
import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";
import { MemberRow } from "@/features/portfolio/contribution-plan/ideal/member-row";
import type { MemberEdit } from "@/features/portfolio/contribution-plan/ideal/member-row";
import { NameCell } from "@/features/portfolio/contribution-plan/ideal/name-cell";
import { RemoveButton } from "@/features/portfolio/contribution-plan/ideal/remove-button";
import { ShareBar } from "@/features/portfolio/contribution-plan/ideal/share-bar";
import { positive } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { useT } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];

interface GroupRowProps {
  index: number;
  group: Group;
  open: boolean;
  hasAmount: boolean;
  waiting: boolean;
  editor?: PlanEditor | undefined;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onToggle: () => void;
}

// A group and, while it is open, its members.
export function GroupRow({
  index,
  group,
  open,
  hasAmount,
  waiting,
  editor,
  memberName,
  onToggle,
}: GroupRowProps) {
  const t = useT();

  const key = `group-${String(index)}`;
  const draft = editor?.draft;
  const edit = draft?.classes[index];
  const editing = edit !== undefined && editor !== undefined;
  const disabled = (draft?.classes ?? []).every(
    (c, i) => i === index || c.locked,
  );
  const today = group.share_bp ?? 0;
  const after = positive(group.amount) ? group.after_share_bp : undefined;
  const expandable = group.members.length > 0 || editing;

  return (
    <>
      <div role="listitem" className={styles.row}>
        <NameCell
          name={editing ? edit.name : group.name}
          position={index}
          {...(expandable
            ? { expander: { open, controls: `${key}-0`, onToggle } }
            : {})}
          {...(editing
            ? {
                onRename: (name: string) => {
                  editor.rename(index, name);
                },
              }
            : {})}
        />

        {editing ? (
          <TargetSlider
            name={group.name}
            value={group.target_bp}
            disabled={disabled}
            onChange={(bp) => {
              editor.setTarget(index, bp);
            }}
          />
        ) : (
          <ShareBar
            name={group.name}
            today={today}
            after={after}
            ideal={group.target_bp}
            position={index}
          />
        )}

        {editing ? (
          <div className={styles.field}>
            <TargetField
              name={group.name}
              value={group.target_bp}
              locked={edit.locked}
              disabled={disabled}
              onChange={(bp) => {
                editor.setTarget(index, bp);
              }}
              onLock={(locked) => {
                editor.setLocked(index, locked);
              }}
            />
          </div>
        ) : (
          <EntryStatus today={today} ideal={group.target_bp} member={false} />
        )}

        {editing ? (
          <RemoveButton
            label={t("contributionPlan.removeClass", { name: group.name })}
            onRemove={() => {
              editor.removeClass(index);
            }}
          />
        ) : (
          <EntryOutcome
            amount={group.amount}
            hasAmount={hasAmount}
            waiting={waiting}
          />
        )}
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
            edit={memberEdit(editor, index, at)}
          />
        ))}

      {open && editing && <ClassEditRow index={index} editor={editor} />}
    </>
  );
}

function memberEdit(
  editor: PlanEditor | undefined,
  index: number,
  at: number,
): MemberEdit | undefined {
  const group = editor?.draft?.classes[index];
  if (editor === undefined || group === undefined) return undefined;

  return {
    split: group.split,
    locked: group.memberLocks[at] ?? false,
    disabled: group.memberLocks.every((l, i) => i === at || l),
    onTarget: (bp) => {
      editor.setMemberTarget(index, at, bp);
    },
    onLock: (locked) => {
      editor.setMemberLocked(index, at, locked);
    },
    onRemove: () => {
      editor.removeMember(index, at);
    },
  };
}
