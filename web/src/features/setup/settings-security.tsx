import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { secondFactorQuery } from "@/features/setup/api";
import { RecoveryCodesDialog } from "@/features/setup/recovery-codes-dialog";
import { SecurityRecoveryGroup } from "@/features/setup/security-recovery-group";
import { SecurityTotpGroup } from "@/features/setup/security-totp-group";
import { SettingsSection } from "@/features/setup/settings-section";
import { useT } from "@/i18n/i18n-provider";

export function SettingsSecurity() {
  const t = useT();
  const { data: factor } = useQuery(secondFactorQuery(useApi()));
  const [codes, setCodes] = useState<string[] | null>(null);

  const handleCloseCodes = () => {
    setCodes(null);
  };

  return (
    <SettingsSection
      topic="security"
      title={t("settings.security.title")}
      description={t("settings.summary.security")}
    >
      <SecurityTotpGroup enabled={factor?.totp ?? false} onCodes={setCodes} />
      <SecurityRecoveryGroup
        factor={factor?.totp ?? false}
        left={factor?.recovery_codes_left ?? 0}
        onCodes={setCodes}
      />
      {codes !== null && (
        <RecoveryCodesDialog codes={codes} onClose={handleCloseCodes} />
      )}
    </SettingsSection>
  );
}
