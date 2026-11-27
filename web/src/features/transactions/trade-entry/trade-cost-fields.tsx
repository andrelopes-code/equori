import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import { CategoryPicker } from "@/features/categories";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

interface TradeCostFieldsProps {
  draft: TradeDraft;
  // The cash currency and its scale: fees and taxes are paid in it (FC1).
  currency: string | undefined;
  currencyScale: number;
  errors: Record<string, string>;
  onChange: (patch: Partial<TradeDraft>) => void;
}

// The fees of a trade and, for a sale, its taxes and the category of the taxes.
export function TradeCostFields({
  draft,
  currency,
  currencyScale,
  errors,
  onChange,
}: TradeCostFieldsProps) {
  const t = useT();
  const sell = draft.side === "sell";
  const set = onChange;

  return (
    <>
      <FormRow>
        <Field width="medium" invalid={errors.fees !== undefined}>
          <FieldTitle label={t("trade.fees")} help={t("trade.feesHelp")} />
          <MoneyInput
            size="field"
            value={draft.fees}
            currency={currency ?? ""}
            scale={currencyScale}
            sign="neutral"
            onChange={(fees) => {
              set({ fees });
            }}
          />
          {errors.fees !== undefined && <FieldError>{errors.fees}</FieldError>}
        </Field>
        {sell && (
          <Field width="medium" invalid={errors.taxes !== undefined}>
            <FieldTitle label={t("trade.taxes")} help={t("trade.taxesHelp")} />
            <MoneyInput
              size="field"
              value={draft.taxes}
              currency={currency ?? ""}
              scale={currencyScale}
              sign="neutral"
              onChange={(taxes) => {
                set({ taxes });
              }}
            />
            {errors.taxes !== undefined && (
              <FieldError>{errors.taxes}</FieldError>
            )}
          </Field>
        )}
      </FormRow>

      {sell && draft.taxes > 0 && (
        <Field invalid={errors.taxes_category_id !== undefined}>
          <FieldLabel>{t("trade.taxesCategory")}</FieldLabel>
          <CategoryPicker
            placeholder={t("trade.taxesCategoryPlaceholder")}
            value={draft.taxesCategoryId}
            amount={-1}
            onChange={(id) => {
              set({ taxesCategoryId: id });
            }}
          />
          {errors.taxes_category_id !== undefined && (
            <FieldError>{errors.taxes_category_id}</FieldError>
          )}
        </Field>
      )}
    </>
  );
}
