import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import styles from "@/features/portfolio/projection/incomes-block/incomes-block.module.css";
import type { IncomeDialogState } from "@/features/portfolio/projection/incomes-block/use-income-dialog";
import { UnitField } from "@/features/portfolio/projection/plan-section/unit-field";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money/money-input";

interface IncomeFieldsProps {
  state: IncomeDialogState;
  currency: string;
  scale: number;
}

// PJ8: the name, the monthly amount and the ages of an income.
export function IncomeFields({ state, currency, scale }: IncomeFieldsProps) {
  const t = useT();

  const { form, change, errors } = state;
  const range = (limits: [number, number] | undefined) =>
    limits &&
    t("portfolio.projection.plan.rangeError", {
      min: limits[0],
      max: limits[1],
    });

  return (
    <div className={styles.form}>
      <Field necessity="none" invalid={errors.name !== undefined}>
        <FieldLabel>{t("portfolio.projection.incomes.field.name")}</FieldLabel>

        <TextField
          autoComplete="off"
          maxLength={60}
          value={form.name}
          onChange={(event) => {
            change({ name: event.target.value });
          }}
        />

        {errors.name !== undefined && (
          <FieldError>
            {t("portfolio.projection.incomes.error.name")}
          </FieldError>
        )}
      </Field>

      <Field necessity="none" invalid={errors.amount !== undefined}>
        <FieldLabel>
          {t("portfolio.projection.incomes.field.amount")}
        </FieldLabel>

        <MoneyInput
          size="field"
          value={form.amount}
          onChange={(amount) => {
            change({ amount });
          }}
          currency={currency}
          scale={scale}
          sign="neutral"
        />

        {errors.amount === undefined && (
          <FieldDescription>
            {t("portfolio.projection.incomes.field.amountHint")}
          </FieldDescription>
        )}
        {errors.amount !== undefined && (
          <FieldError>
            {t("portfolio.projection.incomes.error.amount")}
          </FieldError>
        )}
      </Field>

      <div className={styles.ages}>
        <UnitField
          label={t("portfolio.projection.incomes.field.start")}
          unit={t("portfolio.projection.plan.years")}
          inputMode="numeric"
          value={form.startAge}
          error={range(errors.startAge)}
          onChange={(startAge) => {
            change({ startAge });
          }}
        />

        <UnitField
          label={t("portfolio.projection.incomes.field.end")}
          unit={t("portfolio.projection.plan.years")}
          inputMode="numeric"
          value={form.endAge}
          hint={t("portfolio.projection.incomes.field.endHint")}
          error={range(errors.endAge)}
          onChange={(endAge) => {
            change({ endAge });
          }}
        />
      </div>
    </div>
  );
}
