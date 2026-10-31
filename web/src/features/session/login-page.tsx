import { useRouter, useSearch } from "@tanstack/react-router";
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { SecondFactorChallenge } from "@/features/session/api";
import { LoginPasswordForm } from "@/features/session/login-password-form";
import { LoginSecondFactor } from "@/features/session/login-second-factor";
import styles from "@/features/session/login-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { BrandMark } from "@/ui/brand-mark";

export function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { redirect } = useSearch({ from: "/login" });
  const [challenge, setChallenge] = useState<SecondFactorChallenge | null>(
    null,
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const handleDone = () => {
    router.history.push(redirect ?? "/");
  };

  const handleRestart = (message: string | null) => {
    setChallenge(null);
    setFailure(message);
    setAttempt(attempt + 1);
  };

  // Own element (CP-04): no family draws a brand panel beside a form. `page-header` is the
  // title row of a destination, and the login page is not one.
  return (
    <div className={styles.shell}>
      <aside className={styles.brand}>
        <div className={styles.lockup}>
          <BrandMark size={28} />
          <span className={styles.wordmark}>{t("app.name")}</span>
        </div>
        <div className={styles.statement}>
          <Text
            size="3xl"
            weight="semibold"
            wrap="balance"
            className={styles.tagline}
            render={(props) => <p {...props} />}
          >
            {t("login.tagline")}
          </Text>
          <span className={styles.rule} aria-hidden="true" />
          <Text size="sm" className={styles.caption}>
            {t("login.caption")}
          </Text>
        </div>
        <div className={styles.watermark} aria-hidden="true">
          <BrandMark size={704} />
        </div>
      </aside>
      <Page width="content" ground="surface">
        <PageBody>
          <div className={styles.formArea}>
            <Stack gap={8} className={styles.panel}>
              {challenge === null ? (
                <LoginPasswordForm
                  key={attempt}
                  initialFailure={failure}
                  onChallenge={setChallenge}
                  onDone={handleDone}
                />
              ) : (
                <LoginSecondFactor
                  challenge={challenge}
                  onDone={handleDone}
                  onRestart={handleRestart}
                />
              )}
            </Stack>
          </div>
        </PageBody>
      </Page>
    </div>
  );
}
