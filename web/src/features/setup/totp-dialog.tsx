import { Button } from "@slotted/react/button";
import { CodeBlock } from "@slotted/react/code-block";
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
import { InlineMessage } from "@slotted/react/inline-message";
import { OtpInput } from "@slotted/react/otp-input";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useConfirmTotp } from "@/features/setup/api";
import type { TotpSetup } from "@/features/setup/api";
import { groupsOfFour } from "@/features/setup/groups-of-four";
import { useT } from "@/i18n/i18n-provider";
import { QrCode } from "@/ui/qr-code";

interface TotpDialogProps {
  setup: TotpSetup;
  onClose: () => void;
  onCodes: (codes: string[]) => void;
}

export function TotpDialog({ setup, onClose, onCodes }: TotpDialogProps) {
  const t = useT();
  const confirm = useConfirmTotp();
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<unknown>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open && !confirm.isPending) onClose();
  };

  const handleConfirm = () => {
    setFailure(null);
    confirm
      .mutateAsync(code)
      .then((codes) => {
        onCodes(codes);
        onClose();
      })
      .catch((caught: unknown) => {
        setFailure(caught);
      });
  };

  return (
    <Dialog open size="md" onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("security.totp.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("security.totp.scan")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <QrCode value={setup.uri} label={t("security.totp.qr")} />
            <CodeBlock
              code={groupsOfFour(setup.secret)}
              title={t("security.totp.secret")}
            />
            <Field>
              <FieldLabel>{t("security.totp.code")}</FieldLabel>
              <OtpInput
                length={6}
                groups={[3, 3]}
                value={code}
                onValueChange={setCode}
              />
            </Field>
            {failure !== null && (
              <InlineMessage tone="danger" role="alert">
                {errorText(failure, t)}
              </InlineMessage>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button loading={confirm.isPending} onClick={handleConfirm}>
            {t("security.totp.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
