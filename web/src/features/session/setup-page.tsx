import { useRouter, useRouterState } from "@tanstack/react-router";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { useEffect, useState } from "react";

import styles from "@/features/session/login-page.module.css";
import { SetupForm } from "@/features/session/setup-form";
import { useT } from "@/i18n/i18n-provider";

// The token arrives in the fragment of the address serve printed (W-U1, W-U6 of the Windows
// design); the page reads it once and takes it out of the address bar and the history.
function tokenOf(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? "";
}

// The first-user screen shares the login's measure and form area: both stand before a session.
export function SetupPage() {
  const t = useT();
  const router = useRouter();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const [token] = useState(() => tokenOf(hash));

  useEffect(() => {
    if (hash !== "")
      void router.navigate({ to: "/setup", hash: "", replace: true });
  }, [hash, router]);

  return (
    <Page width="content" ground="surface">
      <PageBody>
        <div className={styles.formArea}>
          <Stack gap={8} className={styles.panel}>
            <Stack gap={2}>
              <Heading level={1} size="2xl">
                {t("setup.title")}
              </Heading>
              <Text tone="muted">{t("setup.subtitle")}</Text>
            </Stack>
            {token === "" && (
              <Alert tone="warning">
                <AlertContent>
                  <AlertDescription>
                    {t("setup.token_missing")}
                  </AlertDescription>
                </AlertContent>
              </Alert>
            )}

            {token !== "" && <SetupForm token={token} />}
          </Stack>
        </div>
      </PageBody>
    </Page>
  );
}
