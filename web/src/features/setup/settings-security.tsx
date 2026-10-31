import { SkeletonText } from "@slotted/react/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { secondFactorQuery } from "@/features/setup/api";
import { RecoveryCodesDialog } from "@/features/setup/recovery-codes-dialog";
import { SecurityPasskeysGroup } from "@/features/setup/security-passkeys-group";
import { SecurityRecoveryGroup } from "@/features/setup/security-recovery-group";
import { SecurityTotpGroup } from "@/features/setup/security-totp-group";
import { SettingsSection } from "@/features/setup/settings-section";
import { useT } from "@/i18n/i18n-provider";

export function SettingsSecurity() {
  const t = useT();
  const { data: factor, isPending } = useQuery(secondFactorQuery(useApi()));
  const [codes, setCodes] = useState<string[] | null>(null);

  const anyFactor =
    factor !== undefined && (factor.totp || factor.passkeys.length > 0);

  const handleCloseCodes = () => {
    setCodes(null);
  };

  return (
    <SettingsSection
      topic="security"
      title={t("settings.security.title")}
      description={t("settings.summary.security")}
    >
      {isPending && <SkeletonText lines={3} />}
      {factor !== undefined && (
        <>
          <SecurityTotpGroup enabled={factor.totp} onCodes={setCodes} />
          <SecurityPasskeysGroup
            passkeys={factor.passkeys}
            onCodes={setCodes}
          />
          <SecurityRecoveryGroup
            factor={anyFactor}
            left={factor.recovery_codes_left}
            onCodes={setCodes}
          />
        </>
      )}
      {codes !== null && (
        <RecoveryCodesDialog codes={codes} onClose={handleCloseCodes} />
      )}
    </SettingsSection>
  );
}
