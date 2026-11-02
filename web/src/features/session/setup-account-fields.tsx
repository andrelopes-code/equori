import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { useT } from "@/i18n/i18n-provider";
import { FormSection } from "@/ui/form-section";

export function SetupAccountFields() {
  const t = useT();

  return (
    <FormSection legend={t("setup.section.account")}>
      <Field required>
        <FieldLabel>{t("setup.email")}</FieldLabel>
        <TextField name="email" type="email" autoComplete="username" />
      </Field>

      <Field required>
        <FieldLabel>{t("setup.password")}</FieldLabel>
        <TextField
          name="password"
          type="password"
          revealable
          autoComplete="new-password"
        />
        <FieldDescription>{t("setup.password.help")}</FieldDescription>
      </Field>
    </FormSection>
  );
}
