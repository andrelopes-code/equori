import { Button } from "@slotted/react/button";
import {
  Field,
  FieldError,
  FieldDescription,
  FieldLabel,
} from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { errorText } from "@/api/problem";
import { useSetCopyPassword } from "@/features/instance";
import { SettingsGroup } from "@/features/setup/settings-group";
import { useT } from "@/i18n/i18n-provider";

// A15.5: the password of the encrypted copies; two equal entries, 12 characters or more.
export function SettingsCopyPassword() {
  const t = useT();
  const save = useSetCopyPassword();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (password !== repeat) {
      setMismatch(true);
      return;
    }

    setMismatch(false);
    save.mutate(password, {
      onSuccess: () => {
        setPassword("");
        setRepeat("");
      },
    });
  };

  return (
    <SettingsGroup title={t("backup.password.title")}>
      <form onSubmit={handleSubmit}>
        <Stack gap={4}>
          <Field required>
            <FieldLabel>{t("backup.password.field")}</FieldLabel>
            <TextField
              type="password"
              autoComplete="new-password"
              value={password}
              onValueChange={setPassword}
            />
            <FieldDescription>{t("backup.password.help")}</FieldDescription>
          </Field>

          <Field required invalid={mismatch}>
            <FieldLabel>{t("backup.password.repeat")}</FieldLabel>
            <TextField
              type="password"
              autoComplete="new-password"
              value={repeat}
              onValueChange={setRepeat}
            />
            {mismatch && (
              <FieldError>{t("backup.password.mismatch")}</FieldError>
            )}
          </Field>

          {save.isError && (
            <InlineMessage tone="danger" role="alert">
              {errorText(save.error, t)}
            </InlineMessage>
          )}
          {save.isSuccess && (
            <InlineMessage tone="success" role="status">
              {t("backup.password.saved")}
            </InlineMessage>
          )}

          <div>
            <Button type="submit" loading={save.isPending}>
              {t("backup.password.save")}
            </Button>
          </div>
        </Stack>
      </form>
    </SettingsGroup>
  );
}
