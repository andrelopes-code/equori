import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { useState } from "react";

import { ProblemError, errorText } from "@/api/problem";
import { useCompleteSecondFactor } from "@/features/session/api";
import type {
  SecondFactorChallenge,
  SecondFactorInput,
} from "@/features/session/api";
import { LoginCodeForm } from "@/features/session/login-code-form";
import styles from "@/features/session/login-page.module.css";
import {
  PasskeyCeremonyError,
  getPasskeyAssertion,
  passkeysAvailable,
} from "@/features/session/passkey-ceremony";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

interface LoginSecondFactorProps {
  challenge: SecondFactorChallenge;
  onDone: () => void;
  onRestart: (failure: string | null) => void;
}

export function LoginSecondFactor({
  challenge,
  onDone,
  onRestart,
}: LoginSecondFactorProps) {
  const t = useT();
  const complete = useCompleteSecondFactor();
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const passkey = challenge.passkey !== null && passkeysAvailable();
  const pending = complete.isPending || asking;

  const submit = async (input: SecondFactorInput) => {
    setFailure(null);
    try {
      await complete.mutateAsync(input);
    } catch (error) {
      if (
        error instanceof ProblemError &&
        error.problem.code === "unauthenticated"
      ) {
        onRestart(t("login.secondFactor.expired"));
        return;
      }
      setFailure(errorText(error, t));
      return;
    }
    onDone();
  };

  const handlePasskey = async () => {
    if (challenge.passkey === null) return;
    setFailure(null);
    setAsking(true);
    try {
      const assertion = await getPasskeyAssertion(challenge.passkey);
      await submit({ passkey: assertion });
    } catch (error) {
      setFailure(
        error instanceof PasskeyCeremonyError
          ? t("login.secondFactor.passkeyFailed")
          : errorText(error, t),
      );
    } finally {
      setAsking(false);
    }
  };

  const handleBack = () => {
    onRestart(null);
  };

  return (
    <>
      <Stack gap={2} className={styles.centered}>
        <Heading level={1} size="2xl">
          {t("login.secondFactor.title")}
        </Heading>
        <Text tone="muted">{t("login.secondFactor.subtitle")}</Text>
      </Stack>

      <Stack gap={6}>
        {passkey && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            fullWidth
            loading={asking}
            onClick={() => void handlePasskey()}
          >
            {t("login.secondFactor.passkey")}
          </Button>
        )}
        <LoginCodeForm
          methods={challenge.methods}
          pending={pending}
          onSubmit={(input) => void submit(input)}
        />
        {failure !== null && <FormNotice>{failure}</FormNotice>}
        <Button type="button" variant="ghost" onClick={handleBack}>
          {t("login.secondFactor.back")}
        </Button>
      </Stack>
    </>
  );
}
