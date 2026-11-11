import { TextField } from "@slotted/react/text-field";

import type { AccountInvitation } from "@/features/setup/api";
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
    <TextField
      aria-label={t("accounts.invite.linkTitle", { email: invitation.email })}
      value={link}
      readOnly
      copyable
      mono
      messages={{ copy: t("accounts.invite.copy") }}
    />
  );
}
