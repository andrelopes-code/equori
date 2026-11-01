import { Button } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { List } from "@slotted/react/list";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { membersQuery, useUpdateMember } from "@/features/setup/api";
import type { BooksMember } from "@/features/setup/api";
import { LeaveBooksDialog } from "@/features/setup/leave-books-dialog";
import { MemberRemoveDialog } from "@/features/setup/member-remove-dialog";
import { MemberRow } from "@/features/setup/member-row";
import { SettingsAccountInvitations } from "@/features/setup/settings-account-invitations";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsInvitations } from "@/features/setup/settings-invitations";
import { SettingsSection } from "@/features/setup/settings-section";
import { meQuery } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";

type Open = { kind: "remove"; member: BooksMember } | { kind: "leave" };

// The members of the active book and their roles (HA52). Only an owner changes a role or removes
// a member; every member can leave.
export function SettingsMembers() {
  const t = useT();
  const api = useApi();
  const me = useQuery(meQuery(api)).data;
  const members = useQuery(membersQuery(api));
  const update = useUpdateMember();
  const [open, setOpen] = useState<Open | null>(null);

  const close = () => {
    setOpen(null);
  };

  return (
    <SettingsSection
      topic="members"
      title={t("settings.members.title")}
      description={t("settings.summary.members")}
    >
      <SettingsGroup>
        <Stack gap={5}>
          {members.error !== null && (
            <InlineMessage tone="danger">
              {errorText(members.error, t)}
            </InlineMessage>
          )}
          {update.error !== null && (
            <InlineMessage tone="danger">
              {errorText(update.error, t)}
            </InlineMessage>
          )}
          {members.isPending && <SkeletonText lines={2} />}
          {members.data !== undefined && me !== undefined && (
            <List variant="ruled" aria-label={t("settings.members.title")}>
              {members.data.map((member) => (
                <MemberRow
                  key={member.member_id}
                  member={member}
                  own={member.member_id === me.id}
                  owner={me.book_role === "owner"}
                  onRole={(role) => {
                    update.mutate({ memberId: member.member_id, role });
                  }}
                  onRemove={() => {
                    setOpen({ kind: "remove", member });
                  }}
                />
              ))}
            </List>
          )}
          <div>
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={() => {
                setOpen({ kind: "leave" });
              }}
            >
              {t("members.leave")}
            </Button>
          </div>
        </Stack>
      </SettingsGroup>
      {me?.book_role === "owner" && <SettingsInvitations />}
      <SettingsAccountInvitations />
      {open?.kind === "remove" && (
        <MemberRemoveDialog member={open.member} onClose={close} />
      )}
      {open?.kind === "leave" && <LeaveBooksDialog onClose={close} />}
    </SettingsSection>
  );
}
