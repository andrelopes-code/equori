import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import { OtpInput } from "@slotted/react/otp-input";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import type {
  SecondFactorChallenge,
  SecondFactorInput,
} from "@/features/session/api";
import { useT } from "@/i18n/i18n-provider";

interface LoginCodeFormProps {
  methods: SecondFactorChallenge["methods"];
  pending: boolean;
  onSubmit: (input: SecondFactorInput) => void;
}

export function LoginCodeForm({
  methods,
  pending,
  onSubmit,
}: LoginCodeFormProps) {
  const t = useT();
  const hasTotp = methods.includes("totp");
  const [recovery, setRecovery] = useState(!hasTotp);

  const handleSubmit = (values: Record<string, unknown>) => {
    const code = String(values.code);
    onSubmit(recovery ? { recovery_code: code } : { totp_code: code });
  };

  const handleSwitch = () => {
    setRecovery(!recovery);
  };

  return (
    <Stack gap={4}>
      <Form
        key={recovery ? "recovery" : "totp"}
        onSubmit={handleSubmit}
        loading={pending}
      >
        <Field required>
          <FieldLabel>
            {recovery
              ? t("login.secondFactor.recovery")
              : t("login.secondFactor.totp")}
          </FieldLabel>
          {recovery ? (
            <OtpInput
              name="code"
              size="lg"
              type="alphanumeric"
              length={16}
              groups={[4, 4, 4, 4]}
              transform={(text) => text.toUpperCase()}
              autoComplete="off"
            />
          ) : (
            <OtpInput name="code" size="lg" length={6} groups={[3, 3]} />
          )}
        </Field>
        <FormActions align="stretch">
          <Button type="submit" size="lg" fullWidth loading={pending}>
            {t("login.secondFactor.submit")}
          </Button>
        </FormActions>
      </Form>

      {hasTotp && (
        <Button type="button" variant="ghost" onClick={handleSwitch}>
          {recovery
            ? t("login.secondFactor.useTotp")
            : t("login.secondFactor.useRecovery")}
        </Button>
      )}
    </Stack>
  );
}
