import { useRouter, useSearch } from "@tanstack/react-router";
import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import { InlineMessage } from "@slotted/react/inline-message";
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { Heading, Text } from "@slotted/react/typography";
import { useRef, useState } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import { useLogin } from "@/features/session/api";
import styles from "@/features/session/login-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { BrandMark } from "@/ui/brand-mark";

export function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { redirect } = useSearch({ from: "/login" });
  const login = useLogin();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (values: Record<string, unknown>) => {
    setFailure(null);
    try {
      await login.mutateAsync({
        email: String(values.email),
        password: String(values.password),
      });
    } catch (error) {
      setFailure(
        error instanceof ProblemError
          ? problemMessage(error.problem, t)
          : t("problem.internal_error"),
      );
      passwordRef.current?.focus();
      return;
    }
    router.history.push(redirect ?? "/");
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
              <Stack gap={2}>
                <Heading level={1} size="2xl">
                  {t("login.title")}
                </Heading>
                <Text tone="muted">{t("login.subtitle")}</Text>
              </Stack>
              <Form onSubmit={submit} loading={login.isPending}>
                {/* Workaround for Slotted finding "The official Form example produces fields with no gap between them": Form draws no gap between its Field children. */}
                <Stack gap={6}>
                  <Field required>
                    <FieldLabel>{t("login.email")}</FieldLabel>
                    <TextField
                      name="email"
                      type="email"
                      size="lg"
                      autoComplete="username"
                    />
                  </Field>
                  <Field required>
                    <FieldLabel>{t("login.password")}</FieldLabel>
                    <TextField
                      ref={passwordRef}
                      name="password"
                      type="password"
                      size="lg"
                      revealable
                      autoComplete="current-password"
                    />
                  </Field>
                  {failure !== null && (
                    <InlineMessage tone="danger" live="assertive" size="md">
                      {failure}
                    </InlineMessage>
                  )}
                </Stack>
                <FormActions align="stretch">
                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={login.isPending}
                  >
                    {t("login.submit")}
                  </Button>
                </FormActions>
              </Form>
            </Stack>
          </div>
        </PageBody>
      </Page>
    </div>
  );
}
