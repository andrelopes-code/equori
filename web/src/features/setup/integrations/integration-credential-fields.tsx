import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";

import type { Aggregator } from "@/features/setup/api";
import { catalogLabel } from "@/features/setup/model/catalog-label";
import { useT } from "@/i18n/i18n-provider";
import { AppLink } from "@/ui/navigation/app-link";

interface IntegrationCredentialFieldsProps {
  fields: Aggregator["credential_fields"];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

// One field per credential of the aggregator; a secret one is write-only and starts empty.
export function IntegrationCredentialFields({
  fields,
  values,
  errors,
  onChange,
}: IntegrationCredentialFieldsProps) {
  const t = useT();

  return (
    <>
      {fields.map((field) => {
        const error = errors[`credentials.${field.name}`];
        return (
          <Field key={field.name} invalid={error !== undefined} required>
            <FieldLabel>
              {catalogLabel(
                t,
                `settings.integrations.field.${field.name}`,
                field.name,
              )}
            </FieldLabel>
            <TextField
              name={field.name}
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              value={values[field.name] ?? ""}
              onChange={(event) => {
                onChange(field.name, event.target.value);
              }}
            />
            {error !== undefined && <FieldError>{error}</FieldError>}
            {field.secret && (
              <FieldDescription>
                {t("settings.integrations.secretHint")}
              </FieldDescription>
            )}
          </Field>
        );
      })}

      <Text size="sm">
        <AppLink
          to={{
            to: "/help/$page",
            params: { page: "connect-bank" },
            hash: "credentials",
          }}
        >
          {t("links.connect.credentialsGuide")}
        </AppLink>
      </Text>
    </>
  );
}
