import { Button } from "@slotted/react/button";
import { List, ListEmpty } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { invitationsQuery, useDeleteInvitation } from "@/features/setup/api";
import { InvitationDialog } from "@/features/setup/invitation-dialog";
import { SettingsGroup } from "@/features/setup/settings-group";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

// The pending invitations of the book; the caller renders it for an owner only (HA25).
export function SettingsInvitations() {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const invitations = useQuery(invitationsQuery(api));
  const revoke = useDeleteInvitation();
  const [creating, setCreating] = useState(false);

  return (
    <SettingsGroup title={t("invitations.title")}>
      <Stack gap={5}>
        {invitations.error !== null && (
          <FormNotice>{errorText(invitations.error, t)}</FormNotice>
        )}
        {revoke.error !== null && (
          <FormNotice>{errorText(revoke.error, t)}</FormNotice>
        )}
        {invitations.data !== undefined && (
          <List variant="ruled" aria-label={t("invitations.title")}>
            {invitations.data.length === 0 && (
              <ListEmpty>{t("invitations.empty")}</ListEmpty>
            )}
            {invitations.data.map((invitation) => (
              <ListItem key={invitation.id}>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>{invitation.email}</ListItemLabel>
                    <ListItemDescription>
                      {[
                        t(`members.role.${invitation.role}`),
                        t("invitations.expires", {
                          date: formatDate(
                            invitation.expires_at.slice(0, 10),
                            locale,
                          ),
                        }),
                      ].join(" · ")}
                    </ListItemDescription>
                  </ListItemBody>
                </ListItemContent>
                <ListItemActions>
                  <Button
                    size="sm"
                    variant="ghost"
                    tone="danger"
                    onClick={() => {
                      revoke.mutate(invitation.id);
                    }}
                  >
                    {t("invitations.revoke")}
                  </Button>
                </ListItemActions>
              </ListItem>
            ))}
          </List>
        )}
        <div>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={() => {
              setCreating(true);
            }}
          >
            {t("invitations.create")}
          </Button>
        </div>
      </Stack>
      {creating && (
        <InvitationDialog
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </SettingsGroup>
  );
}
