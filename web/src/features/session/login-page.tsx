import { useRouter, useSearch } from "@tanstack/react-router";
import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import { InlineMessage } from "@slotted/react/inline-message";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { TextField } from "@slotted/react/text-field";
import { useRef, useState } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import { useLogin } from "@/features/session/api";
import { useT } from "@/i18n/i18n-provider";

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

  return (
    <Page width="content">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("login.title")}</PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Form onSubmit={submit} loading={login.isPending}>
          <Field required>
            <FieldLabel>{t("login.email")}</FieldLabel>
            <TextField name="email" type="email" autoComplete="username" />
          </Field>
          <Field required>
            <FieldLabel>{t("login.password")}</FieldLabel>
            <TextField
              ref={passwordRef}
              name="password"
              type="password"
              autoComplete="current-password"
            />
          </Field>
          {failure !== null && (
            <InlineMessage tone="danger" live="assertive" size="md">
              {failure}
            </InlineMessage>
          )}
          <FormActions>
            <Button type="submit" loading={login.isPending}>
              {t("login.submit")}
            </Button>
          </FormActions>
        </Form>
      </PageBody>
    </Page>
  );
}
