import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { InlineMessage } from "@slotted/react/inline-message";
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { Heading } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText } from "@/api/problem";
import { invitationPreviewQuery } from "@/features/session/api";
import { InvitePreview } from "@/features/session/invite-preview";
import { forgetInviteToken } from "@/features/session/invite-token";
import styles from "@/features/session/login-page.module.css";
import { useInviteToken } from "@/features/session/use-invite-token";
import { useT } from "@/i18n/i18n-provider";

// The invitation screen stands before a session, as the setup: it shares the login's measure.
export function InvitePage() {
  const t = useT();
  const api = useApi();
  const token = useInviteToken();
  const preview = useQuery({
    ...invitationPreviewQuery(api, token),
    enabled: token !== "",
  });

  useEffect(() => {
    if (preview.error instanceof ProblemError && preview.error.status === 404)
      forgetInviteToken();
  }, [preview.error]);

  return (
    <Page width="content" ground="surface">
      <PageBody>
        <div className={styles.formArea}>
          <Stack gap={8} className={styles.panel}>
            <Heading level={1} size="2xl">
              {t("invite.title")}
            </Heading>

            {token === "" && (
              <Alert tone="warning">
                <AlertContent>
                  <AlertDescription>
                    {t("invite.tokenMissing")}
                  </AlertDescription>
                </AlertContent>
              </Alert>
            )}

            {preview.isError && (
              <InlineMessage tone="danger" live="assertive" size="md">
                {errorText(preview.error, t)}
              </InlineMessage>
            )}

            {preview.data !== undefined && (
              <InvitePreview token={token} preview={preview.data} />
            )}
          </Stack>
        </div>
      </PageBody>
    </Page>
  );
}
