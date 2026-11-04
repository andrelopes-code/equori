import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { Heading, Text } from "@slotted/react/typography";
import { useRef, useState } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import { useLogin } from "@/features/session/api";
import type { SecondFactorChallenge } from "@/features/session/api";
import styles from "@/features/session/login-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

interface LoginPasswordFormProps {
  initialFailure: string | null;
  onChallenge: (challenge: SecondFactorChallenge) => void;
  onDone: () => void;
}

export function LoginPasswordForm({
  initialFailure,
  onChallenge,
  onDone,
}: LoginPasswordFormProps) {
  const t = useT();
  const login = useLogin();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<string | null>(initialFailure);

  const submit = async (values: Record<string, unknown>) => {
    setFailure(null);
    let challenge: SecondFactorChallenge | undefined;
    try {
      challenge = await login.mutateAsync({
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
    if (challenge === undefined) {
      onDone();
      return;
    }
    onChallenge(challenge);
  };

  return (
    <>
      <Stack gap={2}>
        <Heading level={1} size="2xl">
          {t("login.title")}
        </Heading>
        <Text tone="muted">{t("login.subtitle")}</Text>
      </Stack>

      <Form onSubmit={submit} loading={login.isPending}>
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
          <FormNotice className={styles.failure}>{failure}</FormNotice>
        )}
        <FormActions align="stretch">
          <Button type="submit" size="lg" fullWidth loading={login.isPending}>
            {t("login.submit")}
          </Button>
        </FormActions>
      </Form>
    </>
  );
}
