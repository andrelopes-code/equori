import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { InvitationPreview } from "@/features/session/api";
import { InviteNewMemberForm } from "@/features/session/invite-new-member-form";
import { useInviteAcceptance } from "@/features/session/use-invite-acceptance";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

interface InvitePreviewProps {
  token: string;
  preview: InvitationPreview;
}

export function InvitePreview({ token, preview }: InvitePreviewProps) {
  const t = useT();
  const { accept, pending, failure } = useInviteAcceptance(token);

  return (
    <Stack gap={6}>
      <Text>
        {preview.kind === "account"
          ? t("invite.accountSummary", {
              inviter: preview.inviter_email,
              email: preview.email,
            })
          : t("invite.summary", {
              inviter: preview.inviter_email,
              email: preview.email,
              books: preview.books_name,
              role: t(`members.role.${preview.role}`),
            })}
      </Text>

      {preview.member_exists ? (
        <Stack gap={4}>
          <Text tone="muted">
            {t("invite.existingMember", { email: preview.email })}
          </Text>
          <Button
            size="lg"
            fullWidth
            loading={pending}
            onClick={() => void accept(null)}
          >
            {t("invite.accept")}
          </Button>
        </Stack>
      ) : (
        <Stack gap={4}>
          <Text tone="muted">{t("invite.newMember")}</Text>
          <InviteNewMemberForm pending={pending} onAccept={accept} />
        </Stack>
      )}

      {failure !== null && <FormNotice>{failure}</FormNotice>}
    </Stack>
  );
}
