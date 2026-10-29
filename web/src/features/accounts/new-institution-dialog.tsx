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

import { InstitutionField } from "@/features/accounts/institution-field";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

// Choosing in the field creates the institution: a catalogue entry with its logo, or the typed name.
export function NewInstitutionDialog({
  onDone,
  onCancel,
}: {
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("institutions.new")}</DialogTitle>
          <DialogDescription>{t("institutions.newHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field required>
            <FieldLabel>{t("institutions.name")}</FieldLabel>
            <InstitutionField
              value={null}
              onChange={(id, name) => {
                if (id !== null) onDone(name ?? "");
              }}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
