import { Button } from "@slotted/react/button";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useDisableTotp, useStartTotp } from "@/features/setup/api";
import type { TotpSetup } from "@/features/setup/api";
import { PasswordDialog } from "@/features/setup/password-dialog";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { TotpDialog } from "@/features/setup/totp-dialog";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

interface SecurityTotpGroupProps {
  enabled: boolean;
  onCodes: (codes: string[]) => void;
}

export function SecurityTotpGroup({
  enabled,
  onCodes,
}: SecurityTotpGroupProps) {
  const t = useT();
  const start = useStartTotp();
  const disable = useDisableTotp();
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [disabling, setDisabling] = useState(false);

  const handleEnable = () => {
    start.mutate(undefined, { onSuccess: setSetup });
  };

  const handleCloseSetup = () => {
    setSetup(null);
  };

  const handleOpenDisable = () => {
    setDisabling(true);
  };

  const handleCloseDisable = () => {
    setDisabling(false);
  };

  return (
    <SettingsGroup
      title={t("security.totp.title")}
      description={t("security.totp.description")}
    >
      <SettingsRow label={t(enabled ? "security.on" : "security.off")}>
        {enabled ? (
          <Button tone="danger" variant="outline" onClick={handleOpenDisable}>
            {t("security.totp.disable")}
          </Button>
        ) : (
          <Button loading={start.isPending} onClick={handleEnable}>
            {t("security.totp.enable")}
          </Button>
        )}
        {start.isError && <FormNotice>{errorText(start.error, t)}</FormNotice>}
      </SettingsRow>
      {setup !== null && (
        <TotpDialog
          setup={setup}
          onClose={handleCloseSetup}
          onCodes={onCodes}
        />
      )}
      {disabling && (
        <PasswordDialog
          title={t("security.totp.disableTitle")}
          hint={t("security.totp.disableHint")}
          action={t("security.totp.disable")}
          onConfirm={disable.mutateAsync}
          onClose={handleCloseDisable}
        />
      )}
    </SettingsGroup>
  );
}
