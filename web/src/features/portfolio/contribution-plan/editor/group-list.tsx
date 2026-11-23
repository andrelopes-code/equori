import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { AssetPickerDialog } from "@/features/portfolio/contribution-plan/editor/asset-picker-dialog";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { GroupEditRow } from "@/features/portfolio/contribution-plan/editor/group-edit-row";
import { GroupListHead } from "@/features/portfolio/contribution-plan/editor/group-list-head";
import { memberKey } from "@/features/portfolio/contribution-plan/editor/picker-entries";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditDraft } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { useT } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

interface GroupListProps {
  // The saved view with the draft laid over it.
  view: Plan;
  draft: EditDraft;
  editor: PlanEditor;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  // The group whose assets panel opens first.
  initialPanel: number | null;
  // Opens the board of the criteria of a group.
  onCriteria: (index: number) => void;
}

// One row per group of the draft, each followed by its assets. One asset picker serves every row.
export function GroupList({
  view,
  draft,
  editor,
  memberName,
  initialPanel,
  onCriteria,
}: GroupListProps) {
  const t = useT();
  const [picking, setPicking] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(initialPanel);

  const taken = new Map(
    draft.classes.flatMap((c) =>
      c.members.map((m) => [memberKey(m), c.name] as const),
    ),
  );

  function handleToggle(index: number) {
    setOpen((now) => (now === index ? null : index));
  }

  function handleRemove(index: number) {
    editor.removeClass(index);
    setOpen((now) => {
      if (now === null || now < index) return now;

      return now === index ? null : now - 1;
    });
  }

  return (
    <div
      role="list"
      aria-label={t("contributionPlan.ideal")}
      className={styles.list}
    >
      <GroupListHead />

      {draft.classes.map((edit, index) => {
        const group = view.classes[index];
        if (group === undefined) return null;

        return (
          <GroupEditRow
            key={String(index)}
            index={index}
            group={group}
            edit={edit}
            disabled={draft.classes.every((c, i) => i === index || c.locked)}
            editor={editor}
            open={open === index}
            memberName={memberName}
            onToggle={() => {
              handleToggle(index);
            }}
            onRemove={() => {
              handleRemove(index);
            }}
            onAddAsset={() => {
              setPicking(index);
            }}
            onCriteria={() => {
              onCriteria(index);
            }}
          />
        );
      })}

      <AssetPickerDialog
        open={picking !== null}
        taken={taken}
        onPick={(ref) => {
          if (picking !== null) editor.addMember(picking, ref);
          setPicking(null);
        }}
        onClose={() => {
          setPicking(null);
        }}
      />
    </div>
  );
}
