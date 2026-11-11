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
import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useUpdateScheduleMatching } from "@/features/planning/api";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";
import { FormNotice } from "@/ui/form-notice";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Schedule = components["schemas"]["Schedule"];

interface RenameDialogProps {
  schedule: Schedule;
  onDone: () => void;
  onCancel: () => void;
}

// The description of a schedule, also one that ended; it names every occurrence, past and future.
export function RenameDialog({
  schedule,
  onDone,
  onCancel,
}: RenameDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const update = useUpdateScheduleMatching();
  const [description, setDescription] = useState(schedule.description);
  const [error, setError] = useState<string | null>(null);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  function handleSave() {
    setError(null);
    update
      .mutateAsync({ id: schedule.id, matching: { description } })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedule.rename")}</DialogTitle>
          <DialogDescription>{t("schedule.rename.hint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormLayout>
            {error !== null && <FormNotice>{error}</FormNotice>}

            <Field required>
              <FieldLabel>{t("schedule.description")}</FieldLabel>
              <TextField
                name="description"
                maxLength={200}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
            </Field>
          </FormLayout>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            loading={update.isPending}
            disabled={description.trim() === ""}
            onClick={handleSave}
          >
            {t("schedule.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
