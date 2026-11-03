import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";

import { groupsOfFour } from "@/features/setup/groups-of-four";
import styles from "@/features/setup/totp-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

interface TotpKeyProps {
  secret: string;
}

// The key the app takes by hand when the camera cannot read the QR code. It is shown, and copied,
// in groups of four: an authenticator app ignores the spaces and a person types it by group.
export function TotpKey({ secret }: TotpKeyProps) {
  const t = useT();

  return (
    <div className={styles.key}>
      <Text size="sm" tone="muted">
        {t("security.totp.keyHint")}
      </Text>

      <TextField
        className={styles.secret}
        aria-label={t("security.totp.secret")}
        value={groupsOfFour(secret)}
        readOnly
        copyable
        mono
        messages={{ copy: t("security.copy") }}
      />
    </div>
  );
}
