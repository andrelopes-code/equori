import { Button } from "@slotted/react/button";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import { TextField } from "@slotted/react/text-field";
import { useMemo, useState } from "react";

import { languages, matchLanguage } from "@/i18n/languages";
import type { Language } from "@/i18n/languages";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

interface InviteNewMemberFormProps {
  pending: boolean;
  onAccept: (extra: { password: string; language: Language }) => Promise<void>;
}

export function InviteNewMemberForm({
  pending,
  onAccept,
}: InviteNewMemberFormProps) {
  const t = useT();
  const [language, setLanguage] = useState<Language>(() =>
    matchLanguage(navigator.languages),
  );

  const languageChoices = useMemo(
    () => languages.map((l) => ({ value: l.language, label: l.nativeName })),
    [],
  );

  const submit = async (values: Record<string, unknown>) => {
    await onAccept({ password: String(values.password), language });
    return undefined;
  };

  return (
    <Form onSubmit={submit} loading={pending}>
      <Field required>
        <FieldLabel>{t("setup.password")}</FieldLabel>
        <TextField
          name="password"
          type="password"
          size="lg"
          revealable
          autoComplete="new-password"
        />
        <FieldDescription>{t("setup.password.help")}</FieldDescription>
      </Field>
      <Field required>
        <FieldLabel>{t("setup.language")}</FieldLabel>
        <ChoiceSelect
          label={t("setup.language")}
          choices={languageChoices}
          value={language}
          multiple={false}
          onChange={(next) => {
            const chosen = languages.find((l) => l.language === next);
            if (chosen !== undefined) setLanguage(chosen.language);
          }}
        />
      </Field>
      <FormActions align="stretch">
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {t("invite.accept")}
        </Button>
      </FormActions>
    </Form>
  );
}
