import { Text } from "@slotted/react/typography";

import { CopyButton } from "@/features/setup/copy-button";
import { groupsOfFour } from "@/features/setup/groups-of-four";
import styles from "@/features/setup/totp-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

interface TotpKeyProps {
  secret: string;
}

// The key the app takes by hand when the camera cannot read the QR code.
export function TotpKey({ secret }: TotpKeyProps) {
  const t = useT();

  return (
    <div className={styles.key}>
      <Text size="sm" tone="muted">
        {t("security.totp.keyHint")}
      </Text>

      <div className={styles.keyRow}>
        <Text
          size="md"
          className={styles.secret}
          aria-label={t("security.totp.secret")}
        >
          {groupsOfFour(secret)}
        </Text>
        <CopyButton text={secret} label={t("security.copy")} />
      </div>
    </div>
  );
}
