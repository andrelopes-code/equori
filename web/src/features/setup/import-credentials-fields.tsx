import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import type { ImportCredentials } from "@/features/setup/use-import-credentials";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";

interface ImportCredentialsFieldsProps {
  credentials: ImportCredentials;
}

// The passphrase of an archive exported with credentials, and the choice to import without them
// (export design C5). It stands under the list: a row holds text and buttons, not a field.
export function ImportCredentialsFields({
  credentials,
}: ImportCredentialsFieldsProps) {
  const t = useT();

  return (
    <FormLayout>
      <Field>
        <FieldLabel>{t("import.passphrase")}</FieldLabel>
        <TextField
          type="password"
          autoComplete="off"
          value={credentials.passphrase}
          onValueChange={credentials.setPassphrase}
        />
        <FieldDescription>{t("import.passphraseHint")}</FieldDescription>
      </Field>

      {credentials.asked && (
        <Checkbox
          checked={credentials.skip}
          onCheckedChange={credentials.setSkip}
        >
          {t("import.skipCredentials")}
        </Checkbox>
      )}
    </FormLayout>
  );
}
