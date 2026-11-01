import { Button } from "@slotted/react/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { AccountInvitationDialog } from "@/features/setup/account-invitation-dialog";
import { SettingsGroup } from "@/features/setup/settings-group";
import { meQuery } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";

// Creating an account is an instance admin operation, whatever the role in the active book.
export function SettingsAccountInvitations() {
  const t = useT();
  const api = useApi();
  const admin = useQuery(meQuery(api)).data?.role === "admin";
  const [creating, setCreating] = useState(false);

  const handleOpen = () => {
    setCreating(true);
  };

  const handleClose = () => {
    setCreating(false);
  };

  if (!admin) return null;

  return (
    <SettingsGroup
      title={t("accounts.invite.title")}
      description={t("accounts.invite.description")}
    >
      <div>
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          onClick={handleOpen}
        >
          {t("accounts.invite.create")}
        </Button>
      </div>
      {creating && <AccountInvitationDialog onClose={handleClose} />}
    </SettingsGroup>
  );
}
