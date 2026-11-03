import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { useRegenerateRecoveryCodes } from "@/features/setup/api";
import { PasswordDialog } from "@/features/setup/password-dialog";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { useT } from "@/i18n/i18n-provider";

interface SecurityRecoveryGroupProps {
  factor: boolean;
  left: number;
  onCodes: (codes: string[]) => void;
}

export function SecurityRecoveryGroup({
  factor,
  left,
  onCodes,
}: SecurityRecoveryGroupProps) {
  const t = useT();
  const regenerate = useRegenerateRecoveryCodes();
  const [asking, setAsking] = useState(false);

  const handleOpen = () => {
    setAsking(true);
  };

  const handleClose = () => {
    setAsking(false);
  };

  const handleConfirm = async (password: string) => {
    onCodes(await regenerate.mutateAsync(password));
  };

  return (
    <SettingsGroup
      title={t("security.recovery.title")}
      description={t("security.recovery.description")}
    >
      {factor ? (
        <SettingsRow label={t("security.recovery.left", { count: left })}>
          <Button variant="outline" onClick={handleOpen}>
            {t("security.recovery.regenerate")}
          </Button>
        </SettingsRow>
      ) : (
        <Text size="sm" tone="muted">
          {t("security.recovery.none")}
        </Text>
      )}
      {asking && (
        <PasswordDialog
          title={t("security.recovery.regenerateTitle")}
          hint={t("security.recovery.regenerateHint")}
          action={t("security.recovery.regenerate")}
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      )}
    </SettingsGroup>
  );
}
