import { IconButton } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { TextField } from "@slotted/react/text-field";

import type { CardSetupDraft } from "@/features/accounts/account-draft";
import { useT } from "@/i18n/i18n-provider";
import widths from "@/ui/field-width.module.css";
import { FormRow } from "@/ui/form-row";

type PlasticCard = CardSetupDraft["cards"][number];

interface PlasticCardFieldsProps {
  index: number;
  value: PlasticCard;
  onChange: (patch: Partial<PlasticCard>) => void;
  onRemove: () => void;
  errors: Record<string, string>;
}

// One plastic card of a card account: its holder and last four digits are one answer (F2).
export function PlasticCardFields({
  index,
  value,
  onChange,
  onRemove,
  errors,
}: PlasticCardFieldsProps) {
  const t = useT();

  const holderError = errors[`cards.${String(index)}.holder`];
  const lastFourError = errors[`cards.${String(index)}.last_four`];

  return (
    <>
      <FormRow>
        <Field invalid={holderError !== undefined} required>
          <FieldLabel>{t("accountForm.holder")}</FieldLabel>
          <TextField
            value={value.holder}
            maxLength={120}
            onChange={(event) => {
              onChange({ holder: event.target.value });
            }}
          />
          {holderError !== undefined && <FieldError>{holderError}</FieldError>}
        </Field>

        <Field
          className={widths.medium}
          invalid={lastFourError !== undefined}
          required
        >
          <FieldLabel>{t("accountForm.lastFour")}</FieldLabel>
          <TextField
            value={value.lastFour}
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => {
              onChange({ lastFour: event.target.value.replace(/\D/gu, "") });
            }}
          />
          {lastFourError !== undefined && (
            <FieldError>{lastFourError}</FieldError>
          )}
        </Field>
      </FormRow>

      <Inline gap={2} align="center" justify="between">
        <Checkbox
          checked={value.virtual}
          onCheckedChange={(virtual) => {
            onChange({ virtual });
          }}
        >
          {t("accountForm.virtual")}
        </Checkbox>
        <IconButton
          variant="ghost"
          tone="secondary"
          aria-label={t("accountForm.removeCard", { n: index + 1 })}
          onClick={onRemove}
        >
          <Icon>
            <Glyph name="trash" />
          </Icon>
        </IconButton>
      </Inline>
    </>
  );
}
