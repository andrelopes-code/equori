import { Button, IconButton } from "@slotted/react/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Switch } from "@slotted/react/switch";
import { TextField } from "@slotted/react/text-field";

import type { CardSetupDraft } from "@/features/accounts/account-draft";
import { BillingRuleFields } from "@/features/accounts/billing-rule-fields";
import styles from "@/features/accounts/account-form.module.css";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";

// A card's setup when it is created: its billing cycle, its limit and its plastic cards.
export function CardSetupSection({
  value,
  onChange,
  errors,
  currency,
  scale,
}: {
  value: CardSetupDraft;
  onChange: (next: CardSetupDraft) => void;
  errors: Record<string, string>;
  currency: string;
  scale: number;
}) {
  const t = useT();
  const setRow = (
    index: number,
    patch: Partial<CardSetupDraft["cards"][number]>,
  ) => {
    onChange({
      ...value,
      cards: value.cards.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    });
  };
  return (
    <>
      <FieldGroup>
        <FieldGroupLegend>{t("accountForm.billing")}</FieldGroupLegend>
        <FieldGroupContent>
          <BillingRuleFields
            value={value}
            onChange={(billing) => {
              onChange({ ...value, ...billing });
            }}
            errors={errors}
          />
        </FieldGroupContent>
      </FieldGroup>
      <FieldGroup>
        <FieldGroupLegend>{t("accountForm.limitGroup")}</FieldGroupLegend>
        <FieldGroupContent>
          <Field>
            <FieldLabel>{t("accountForm.limit")}</FieldLabel>
            <MoneyInput
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
        </FieldGroupContent>
      </FieldGroup>
      <FieldGroup>
        <FieldGroupLegend>{t("accountForm.cards")}</FieldGroupLegend>
        <FieldGroupContent>
          <Stack gap={3}>
            {value.cards.map((row, index) => {
              const holderError = errors[`cards.${String(index)}.holder`];
              const lastFourError = errors[`cards.${String(index)}.last_four`];
              return (
                // The rows have no identity of their own until the card is created.
                <div key={index} className={styles.cardRow}>
                  <Field invalid={holderError !== undefined} required>
                    <FieldLabel>{t("accountForm.holder")}</FieldLabel>
                    <TextField
                      value={row.holder}
                      maxLength={120}
                      onChange={(event) => {
                        setRow(index, { holder: event.target.value });
                      }}
                    />
                    {holderError !== undefined && (
                      <FieldError>{holderError}</FieldError>
                    )}
                  </Field>
                  <Field invalid={lastFourError !== undefined} required>
                    <FieldLabel>{t("accountForm.lastFour")}</FieldLabel>
                    <TextField
                      value={row.lastFour}
                      inputMode="numeric"
                      maxLength={4}
                      onChange={(event) => {
                        setRow(index, {
                          lastFour: event.target.value.replace(/\D/gu, ""),
                        });
                      }}
                    />
                    {lastFourError !== undefined && (
                      <FieldError>{lastFourError}</FieldError>
                    )}
                  </Field>
                  <Inline gap={2} wrap="nowrap" align="end">
                    <Switch
                      checked={row.virtual}
                      onCheckedChange={(virtual) => {
                        setRow(index, { virtual });
                      }}
                    >
                      {t("accountForm.virtual")}
                    </Switch>
                    <IconButton
                      variant="ghost"
                      tone="secondary"
                      aria-label={t("accountForm.removeCard", {
                        n: index + 1,
                      })}
                      onClick={() => {
                        onChange({
                          ...value,
                          cards: value.cards.filter((_, i) => i !== index),
                        });
                      }}
                    >
                      <Icon>
                        <Glyph name="trash" />
                      </Icon>
                    </IconButton>
                  </Inline>
                </div>
              );
            })}
            <div>
              <Button
                variant="outline"
                tone="secondary"
                start={
                  <Icon size="sm">
                    <Glyph name="plus" />
                  </Icon>
                }
                onClick={() => {
                  onChange({
                    ...value,
                    cards: [
                      ...value.cards,
                      { holder: "", lastFour: "", virtual: false },
                    ],
                  });
                }}
              >
                {t("accountForm.addCard")}
              </Button>
            </div>
          </Stack>
        </FieldGroupContent>
      </FieldGroup>
    </>
  );
}
