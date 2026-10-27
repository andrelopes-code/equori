import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { useState } from "react";

import type { PlanLine } from "@/features/planning/plan-groups";
import type { PlanFormat } from "@/features/planning/use-plan-format";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { useStableCallback } from "@/ui/use-stable-callback";

// Sends the whole unassigned rest to one category of the plan (A132).
export function PlanDistributeDialog({
  rows,
  rest,
  format,
  onCancel,
  onPick,
}: {
  rows: readonly PlanLine[];
  rest: number;
  format: PlanFormat;
  onCancel: () => void;
  onPick: (categoryId: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open size="sm" fullScreen="never" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("plan.distribute.one")}</DialogTitle>
          <DialogDescription>
            {t("plan.distribute.rest", { amount: format.money(rest) })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ChoiceSelect
            label={t("plan.distribute.pick")}
            multiple={false}
            value={value}
            choices={rows
              .filter((l) => l.row.counted)
              .map((l) => ({ value: l.row.category_id, label: l.label }))}
            onChange={(next) => {
              setValue(typeof next === "string" ? next : null);
            }}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("plan.keepEditing")}
          </Button>
          <Button
            disabled={value === null}
            onClick={() => {
              if (value !== null) onPick(value);
            }}
          >
            {t("plan.distribute.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
