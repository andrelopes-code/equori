import { Text } from "@slotted/react/typography";

import type { AccountInvitation } from "@/features/setup/api";
import styles from "@/features/setup/account-invitation-dialog.module.css";
import { CopyButton } from "@/features/setup/copy-button";
import { useT } from "@/i18n/i18n-provider";

interface AccountInvitationLinkProps {
  invitation: AccountInvitation;
}

// The link is shown once: the server keeps only the hash of its token.
export function AccountInvitationLink({
  invitation,
}: AccountInvitationLinkProps) {
  const t = useT();
  const link = `${window.location.origin}/invite#token=${invitation.token}`;

  return (
    <div>
      <Text size="sm" className={styles.link}>
        {link}
      </Text>

      <div className={styles.actions}>
        <CopyButton text={link} label={t("accounts.invite.copy")} />
      </div>
    </div>
  );
}
