import type { UploadFile } from "@slotted/core/upload";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
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
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { Upload } from "@slotted/react/upload";
import { useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { useImportPrices } from "@/features/instruments/api";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

// The contract allows 10,000 lines of about 50 bytes; the server answers 413 above its own limit.
const maxBytes = 2 * 1024 * 1024;

// Imports the prices of a CSV file. The import is all or nothing: the result is the number of
// prices recorded, or the line the server rejected with the statement that nothing was recorded.
export function PriceImportDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const send = useImportPrices();
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [recorded, setRecorded] = useState<number | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const file = files.find((f) => f.status !== "rejected")?.file;
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });
  const submit = () => {
    if (file === undefined) return;
    setProblems([]);
    send
      .mutateAsync(file)
      .then((result) => {
        setRecorded(result.recorded);
      })
      .catch((caught: unknown) => {
        const lines =
          caught instanceof ProblemError
            ? Object.entries(fieldErrors(caught.problem)).map(
                ([field, message]) => `${field}: ${message}`,
              )
            : [];
        setProblems(lines.length > 0 ? lines : [errorText(caught, t)]);
      });
  };
  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("prices.import.title")}</DialogTitle>
          <DialogDescription>
            {t("prices.import.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <Alert tone="info">
              <AlertContent>
                <AlertDescription>
                  {t("prices.import.allOrNothing")}
                </AlertDescription>
              </AlertContent>
            </Alert>
            {recorded !== null ? (
              <InlineMessage tone="success">
                {t("prices.import.recorded", { count: recorded })}
              </InlineMessage>
            ) : (
              <Field invalid={refusal !== null || problems.length > 0}>
                <FieldLabel>{t("prices.import.file")}</FieldLabel>
                <Upload
                  accept=".csv,text/csv"
                  maxSize={maxBytes}
                  preview="none"
                  view="none"
                  files={files}
                  onFilesChange={(next) => {
                    setFiles(next);
                    setProblems([]);
                    if (next.some((f) => f.status !== "rejected"))
                      setRefusal(null);
                  }}
                  onReject={(rejected) => {
                    setRefusal(
                      rejected[0]?.reason === "size"
                        ? t("prices.import.tooLarge")
                        : t("prices.import.wrongType"),
                    );
                  }}
                />
                {refusal !== null && <FieldError>{refusal}</FieldError>}
                {problems.map((line) => (
                  <FieldError key={line}>{line}</FieldError>
                ))}
                {problems.length > 0 && (
                  <FieldError>{t("prices.import.nothing")}</FieldError>
                )}
              </Field>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t(recorded === null ? "detail.cancel" : "prices.import.close")}
          </Button>
          {recorded === null && (
            <Button
              disabled={file === undefined}
              loading={send.isPending}
              onClick={submit}
            >
              {t("prices.import.send")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
