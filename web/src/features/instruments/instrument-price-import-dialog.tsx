import type { UploadFile } from "@slotted/core/upload";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { Textarea } from "@slotted/react/textarea";
import { Upload } from "@slotted/react/upload";
import { useState } from "react";

import { PriceSeriesPreview } from "@/features/instruments/price-series-preview";
import { usePriceSeriesImport } from "@/features/instruments/use-price-series-import";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

interface InstrumentPriceImportDialogProps {
  code: string;
  quote: string;
  onClose: () => void;
}

const maxBytes = 2 * 1024 * 1024;

// MQ39: the quotes of one instrument from a file or a pasted table. The browser reads the text;
// the server counts what Record would change before anything is stored.
export function InstrumentPriceImportDialog({
  code,
  quote,
  onClose,
}: InstrumentPriceImportDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const importer = usePriceSeriesImport(code, quote);
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);

  const openChange = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  function handleFiles(next: readonly UploadFile[]) {
    setFiles(next);
    const chosen = next.find((f) => f.status !== "rejected");
    if (chosen !== undefined) setRefusal(null);
    importer.loadFile(chosen?.file);
  }

  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("prices.import.one.title", { code })}</DialogTitle>
          <DialogDescription>
            {t("prices.import.one.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Field necessity="none" invalid={refusal !== null}>
              <FieldLabel>{t("prices.import.file")}</FieldLabel>
              <Upload
                accept=".csv,.txt,text/csv,text/plain"
                maxSize={maxBytes}
                preview="none"
                view="none"
                files={files}
                onFilesChange={handleFiles}
                onReject={(rejected) => {
                  setRefusal(
                    rejected[0]?.reason === "size"
                      ? t("prices.import.tooLarge")
                      : t("prices.import.wrongType"),
                  );
                }}
              />
              {refusal !== null && <FieldError>{refusal}</FieldError>}
            </Field>

            <Field necessity="none">
              <FieldLabel>{t("prices.import.paste.label")}</FieldLabel>
              <Textarea
                mono
                value={importer.text}
                onValueChange={importer.changeText}
              />
              <FieldDescription>
                {t("prices.import.paste.hint")}
              </FieldDescription>
            </Field>

            {importer.text !== "" && (
              <PriceSeriesPreview
                code={code}
                quote={quote}
                series={importer.series}
                counts={importer.counts}
                onChoice={importer.changeChoice}
              />
            )}
            {importer.problem !== null && (
              <FormNotice>{importer.problem}</FormNotice>
            )}
            {importer.recorded !== null && (
              <FormNotice tone="success">
                {t("prices.import.recorded", {
                  count:
                    importer.recorded.new +
                    importer.recorded.replaced +
                    importer.recorded.unchanged,
                })}
              </FormNotice>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t(
              importer.recorded === null
                ? "detail.cancel"
                : "prices.import.close",
            )}
          </Button>
          {importer.recorded === null && (
            <Button
              disabled={!importer.valid}
              loading={importer.recording}
              onClick={importer.record}
            >
              {t("prices.import.preview.record")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
