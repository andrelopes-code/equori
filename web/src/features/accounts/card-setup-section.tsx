import { Button } from "@slotted/react/button";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Glyph, Icon } from "@slotted/react/icon";

import type { CardSetupDraft } from "@/features/accounts/account-draft";
import { BillingRuleFields } from "@/features/accounts/billing-rule-fields";
import { PlasticCardFields } from "@/features/accounts/plastic-card-fields";
import { useT } from "@/i18n/i18n-provider";
import widths from "@/ui/field-width.module.css";
import { FormSection } from "@/ui/form-section";
import { MoneyInput } from "@/ui/money-input";

interface CardSetupSectionProps {
  value: CardSetupDraft;
  onChange: (next: CardSetupDraft) => void;
  errors: Record<string, string>;
  currency: string;
  scale: number;
}

// A card's setup when it is created: its billing cycle, its limit and its plastic cards.
export function CardSetupSection({
  value,
  onChange,
  errors,
  currency,
  scale,
}: CardSetupSectionProps) {
  const t = useT();

  function handleAddCard() {
    onChange({
      ...value,
      cards: [...value.cards, { holder: "", lastFour: "", virtual: false }],
    });
  }

  return (
    <>
      <FormSection legend={t("accountForm.billing")}>
        <BillingRuleFields
          value={value}
          onChange={(billing) => {
            onChange({ ...value, ...billing });
          }}
          errors={errors}
        />
      </FormSection>

      <FormSection legend={t("accountForm.limitGroup")}>
        <Field>
          <FieldLabel>{t("accountForm.limit")}</FieldLabel>
          <MoneyInput
            size="field"
            className={widths.medium}
            value={value.limit}
            onChange={(limit) => {
              onChange({ ...value, limit });
            }}
            currency={currency}
            scale={scale}
            sign="neutral"
          />
          <FieldDescription>{t("accountForm.limitHint")}</FieldDescription>
        </Field>
      </FormSection>

      <FormSection legend={t("accountForm.cards")}>
        {value.cards.map((row, index) => (
          // The rows have no identity of their own until the card is created.
          <PlasticCardFields
            key={index}
            index={index}
            value={row}
            onChange={(patch) => {
              onChange({
                ...value,
                cards: value.cards.map((r, i) =>
                  i === index ? { ...r, ...patch } : r,
                ),
              });
            }}
            onRemove={() => {
              onChange({
                ...value,
                cards: value.cards.filter((_, i) => i !== index),
              });
            }}
            errors={errors}
          />
        ))}
        <div>
          <Button
            variant="outline"
            tone="secondary"
            start={
              <Icon size="sm">
                <Glyph name="plus" />
              </Icon>
            }
            onClick={handleAddCard}
          >
            {t("accountForm.addCard")}
          </Button>
        </div>
      </FormSection>
    </>
  );
}
