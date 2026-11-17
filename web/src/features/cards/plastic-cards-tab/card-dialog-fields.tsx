import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import type { components } from "@/api/schema.gen";
import { CardDialogPreview } from "@/features/cards/plastic-cards-tab/card-dialog-preview";
import type { FaceBase } from "@/features/cards/plastic-cards-tab/plastic-card-faces";
import type { CardForm } from "@/features/cards/plastic-cards-tab/use-card-form";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { NetworkField } from "@/ui/card-face/network/network-field";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormRow } from "@/ui/form-layout/form-row";

type Card = components["schemas"]["Card"];

interface CardDialogFieldsProps {
  form: CardForm;
  card: Card | undefined;
  base: FaceBase;
}

// The face with the dialog's values, then the holder, the last four digits, the kind and the
// network.
export function CardDialogFields({ form, card, base }: CardDialogFieldsProps) {
  const t = useT();
  const { locale } = useAppLocaleState();

  return (
    <FormLayout>
      {form.summary !== null && <FormNotice>{form.summary}</FormNotice>}

      <CardDialogPreview base={base} form={form} />

      <FormRow>
        <Field invalid={form.errors.holder !== undefined} required>
          <FieldLabel>{t("accountForm.holder")}</FieldLabel>
          <TextField
            value={form.holder}
            maxLength={120}
            onChange={(event) => {
              form.setHolder(event.target.value);
            }}
          />
          {form.errors.holder !== undefined && (
            <FieldError>{form.errors.holder}</FieldError>
          )}
        </Field>

        <Field invalid={form.errors.last_four !== undefined} required>
          <FieldLabel>{t("accountForm.lastFour")}</FieldLabel>
          <TextField
            value={form.lastFour}
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => {
              form.setLastFour(event.target.value.replace(/\D/gu, ""));
            }}
          />
          {form.errors.last_four !== undefined && (
            <FieldError>{form.errors.last_four}</FieldError>
          )}
        </Field>
      </FormRow>

      {card === undefined && (
        <Checkbox checked={form.virtual} onCheckedChange={form.setVirtual}>
          {t("accountForm.virtual")}
        </Checkbox>
      )}

      <NetworkField
        name="card-network"
        value={form.network}
        region={locale.region}
        stored={card?.network}
        onChange={form.setNetwork}
      />
    </FormLayout>
  );
}
