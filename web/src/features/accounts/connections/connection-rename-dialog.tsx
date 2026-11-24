import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useRenameConnection } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface ConnectionRenameDialogProps {
  connection: components["schemas"]["Connection"];
  onClose: () => void;
}

export function ConnectionRenameDialog({
  connection,
  onClose,
}: ConnectionRenameDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const rename = useRenameConnection();
  const [name, setName] = useState(connection.name);

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    rename.mutate(
      { id: connection.id, name: name.trim() },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open={overlayOpen}
      size="sm"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("links.renameOf", { name: connection.name })}
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            <FormLayout fill>
              {rename.isError && (
                <FormNotice>{errorText(rename.error, t)}</FormNotice>
              )}

              <Field required>
                <FieldLabel>{t("links.connect.bank")}</FieldLabel>
                <TextField
                  name="name"
                  value={name}
                  maxLength={60}
                  autoComplete="off"
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              </Field>
            </FormLayout>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onClose}>
              {t("detail.cancel")}
            </Button>
            <Button
              type="submit"
              loading={rename.isPending}
              disabled={name.trim() === ""}
            >
              {t("detail.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
