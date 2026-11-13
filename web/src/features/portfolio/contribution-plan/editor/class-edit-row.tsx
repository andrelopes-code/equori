import { Button } from "@slotted/react/button";
import { Switch } from "@slotted/react/switch";
import { useState } from "react";

import { AssetPickerDialog } from "@/features/portfolio/contribution-plan/editor/asset-picker-dialog";
import { memberKey } from "@/features/portfolio/contribution-plan/editor/picker-entries";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";
import { useT } from "@/i18n/i18n-provider";

interface ClassEditRowProps {
  index: number;
  editor: PlanEditor;
}

// The row under an open class in edit mode: the split switch and the way to add an asset.
export function ClassEditRow({ index, editor }: ClassEditRowProps) {
  const t = useT();
  const [picking, setPicking] = useState(false);

  const draft = editor.draft;
  const cls = draft?.classes[index];
  const taken = new Map(
    (draft?.classes ?? []).flatMap((c) =>
      c.members.map((m) => [memberKey(m), c.name] as const),
    ),
  );

  if (cls === undefined) return null;

  return (
    <div role="listitem" className={styles.editRow}>
      <Switch
        checked={cls.split}
        onCheckedChange={(on) => {
          editor.setSplit(index, on);
        }}
      >
        {t("contributionPlan.split")}
      </Switch>

      <Button
        size="sm"
        variant="outline"
        tone="secondary"
        onClick={() => {
          setPicking(true);
        }}
      >
        {t("contributionPlan.addAsset")}
      </Button>

      <AssetPickerDialog
        open={picking}
        taken={taken}
        onPick={(ref) => {
          editor.addMember(index, ref);
          setPicking(false);
        }}
        onClose={() => {
          setPicking(false);
        }}
      />
    </div>
  );
}
