import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useDeleteInstrument } from "@/features/instruments/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/dialogs/confirm-dialog";
import { HeaderAction } from "@/ui/navigation/header-action";

interface RemoveInstrumentActionProps {
  instrument: components["schemas"]["Instrument"];
}

// A223 RM5: the header action that deletes a security and the confirmation it asks first. A
// refusal (instrument_in_use) is shown in the dialog, which stays open.
export function RemoveInstrumentAction({
  instrument,
}: RemoveInstrumentActionProps) {
  const t = useT();
  const navigate = useNavigate();
  const remove = useDeleteInstrument();

  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  if (instrument.type === "currency") return null;

  function handleOpen() {
    setFailure(null);
    setOpen(true);
  }

  function handleConfirm() {
    setFailure(null);
    remove
      .mutateAsync(instrument.code)
      .then(() => navigate({ to: "/instruments" }))
      .catch((caught: unknown) => {
        setFailure(caught);
      });
  }

  return (
    <>
      <HeaderAction
        label={t("instrument.remove")}
        glyph="trash"
        wordsOnly
        onClick={handleOpen}
      />

      {open && (
        <ConfirmDialog
          title={t("instrument.remove.title", { code: instrument.code })}
          description={t("instrument.remove.body")}
          confirmLabel={t("instrument.remove.confirm")}
          pending={remove.isPending}
          error={failure === null ? null : errorText(failure, t)}
          onConfirm={handleConfirm}
          onCancel={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
