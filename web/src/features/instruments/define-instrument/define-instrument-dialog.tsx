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

import { DefineInstrumentFields } from "@/features/instruments/define-instrument/define-instrument-fields";
import { InstrumentSearch } from "@/features/instruments/define-instrument/instrument-search";
import { probeInput } from "@/features/instruments/define-instrument/probe-input";
import { QuoteProbe } from "@/features/instruments/define-instrument/quote-probe";
import { useInstrumentDefine } from "@/features/instruments/define-instrument/use-instrument-define";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

interface DefineInstrumentDialogProps {
  onDone: () => void;
  onCancel: () => void;
}

// Defines a security or currency for the whole instance.
export function DefineInstrumentDialog({
  onDone,
  onCancel,
}: DefineInstrumentDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const form = useInstrumentDefine(onDone);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            form.submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("instruments.define")}</DialogTitle>
            <DialogDescription>
              {t("instruments.define.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormLayout>
              <InstrumentSearch onChoose={form.apply} />

              <DefineInstrumentFields form={form} />

              <QuoteProbe
                input={probeInput({
                  code: form.code,
                  type: form.type,
                  exchange: form.exchange,
                  quote: form.chosenQuote,
                })}
              />
            </FormLayout>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onCancel}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" loading={form.pending}>
              {t("instruments.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
