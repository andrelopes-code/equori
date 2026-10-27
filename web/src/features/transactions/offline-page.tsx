import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { readDeviceUser } from "@/features/session";
import { OfflineQueue } from "@/features/transactions/offline-queue";
import { useT } from "@/i18n/i18n-provider";

// P3 of ADR 022: the profile request got no HTTP answer. The screen queues texts for the
// device's last user; the server reads them once it answers again.
export function OfflinePage() {
  const t = useT();
  const navigate = useNavigate();
  const [user] = useState(readDeviceUser);

  return (
    <Page width="wide">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("offline.title")}</PageHeaderHeading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <Button
                variant="outline"
                tone="secondary"
                onClick={() => {
                  void navigate({ to: "/" });
                }}
              >
                {t("offline.retry")}
              </Button>
            </PageHeaderActions>
          </PageHeaderTitleRow>
          <PageHeaderDescription>
            {t("offline.subheading")}
          </PageHeaderDescription>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {user === null ? (
          <Alert tone="info">
            <AlertContent>
              <AlertDescription>{t("offline.noUser")}</AlertDescription>
            </AlertContent>
          </Alert>
        ) : (
          <OfflineQueue user={user} />
        )}
      </PageBody>
    </Page>
  );
}
