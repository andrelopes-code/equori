import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";

import type { FixedIncomeDraft } from "@/features/transactions/fixed-income-entry/fixed-income-draft";
import { monthsAfter } from "@/features/transactions/fixed-income-entry/maturity";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormSection } from "@/ui/form-layout/form-section";

interface FixedIncomeTermFieldsProps {
  draft: FixedIncomeDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<FixedIncomeDraft>) => void;
}

const shortcuts = [6, 12, 24, 36, 60];

// The term of a new contract: the maturity with month shortcuts, daily liquidity and the grace date.
export function FixedIncomeTermFields({
  draft,
  errors,
  onChange,
}: FixedIncomeTermFieldsProps) {
  const t = useT();
  const matures = errors["contract.matures_on"];
  const redeemable = errors["contract.redeemable_from"];

  return (
    <FormSection legend={t("fixedIncome.term")}>
      <Field required invalid={matures !== undefined}>
        <FieldLabel>{t("fixedIncome.maturesOn")}</FieldLabel>
        <DateInput
          name="matures_on"
          value={draft.maturesOn}
          min={draft.appliedOn}
          shortcuts={false}
          onChange={(maturesOn) => {
            onChange({ maturesOn });
          }}
        />
        <Inline gap={2}>
          {shortcuts.map((months) => (
            <Button
              key={months}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange({ maturesOn: monthsAfter(draft.appliedOn, months) });
              }}
            >
              {t("fixedIncome.months", { count: months })}
            </Button>
          ))}
        </Inline>
        {matures !== undefined && <FieldError>{matures}</FieldError>}
      </Field>

      <Checkbox
        checked={draft.dailyLiquidity}
        onCheckedChange={(checked) => {
          onChange({ dailyLiquidity: checked });
        }}
      >
        {t("terms.dailyLiquidity")}
      </Checkbox>

      <Field invalid={redeemable !== undefined}>
        <FieldLabel>{t("terms.redeemableFrom")}</FieldLabel>
        <DateInput
          name="redeemable_from"
          value={draft.redeemableFrom ?? ""}
          min={draft.appliedOn}
          max={draft.maturesOn === "" ? undefined : draft.maturesOn}
          shortcuts={false}
          clearable
          onChange={(date) => {
            onChange({ redeemableFrom: date === "" ? null : date });
          }}
        />
        {redeemable === undefined ? (
          <FieldDescription>{t("terms.redeemableFromHint")}</FieldDescription>
        ) : (
          <FieldError>{redeemable}</FieldError>
        )}
      </Field>
    </FormSection>
  );
}
