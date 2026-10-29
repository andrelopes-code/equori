import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import type { AccountDraft } from "@/features/accounts/account-draft";
import type { Kind } from "@/features/accounts/account-kinds";
import { InstitutionField } from "@/features/accounts/institution-field";
import { KindSummary } from "@/features/accounts/kind-summary";
import { useT } from "@/i18n/i18n-provider";
import { FormSection } from "@/ui/form-section";

interface AccountIdentitySectionProps {
  mode: "create" | "edit";
  kind: Kind;
  draft: AccountDraft;
  onPatch: (patch: Partial<AccountDraft>) => void;
  onChangeKind?: (() => void) | undefined;
  errors: Record<string, string>;
}

// What the account is and where it is held.
export function AccountIdentitySection({
  mode,
  kind,
  draft,
  onPatch,
  onChangeKind,
  errors,
}: AccountIdentitySectionProps) {
  const t = useT();

  return (
    <FormSection legend={t("accountForm.identity")}>
      <Field required>
        <FieldLabel>{t("accountForm.kind")}</FieldLabel>
        <KindSummary
          kind={kind}
          onChange={mode === "create" ? onChangeKind : undefined}
        />
        {mode === "edit" && (
          <FieldDescription>{t("accountForm.kindFixed")}</FieldDescription>
        )}
      </Field>

      <Field invalid={errors.name !== undefined} required>
        <FieldLabel>{t("accountForm.name")}</FieldLabel>
        <TextField
          name="name"
          value={draft.name}
          maxLength={120}
          onChange={(event) => {
            onPatch({ name: event.target.value });
          }}
        />
        {errors.name !== undefined && <FieldError>{errors.name}</FieldError>}
      </Field>

      <Field invalid={errors.institution_id !== undefined}>
        <FieldLabel>{t("accountForm.institution")}</FieldLabel>
        <InstitutionField
          value={draft.institutionId}
          onChange={(institutionId) => {
            onPatch({ institutionId });
          }}
        />
        {errors.institution_id !== undefined && (
          <FieldError>{errors.institution_id}</FieldError>
        )}
        <FieldDescription>{t("accountForm.institutionHint")}</FieldDescription>
      </Field>
    </FormSection>
  );
}
