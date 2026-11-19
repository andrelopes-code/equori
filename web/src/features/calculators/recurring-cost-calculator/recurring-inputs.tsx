import { Field, FieldLabel } from "@slotted/react/field";

import { AmountField } from "@/features/calculators/fields/amount-field";
import { ChoiceField } from "@/features/calculators/fields/choice-field";
import { CountField } from "@/features/calculators/fields/count-field";
import { FilledNote } from "@/features/calculators/fields/filled-note";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/recurring-cost-calculator/address-keys";
import type { FillableSchedule } from "@/features/calculators/recurring-cost-calculator/fillable-schedules";
import type { Per } from "@/features/calculators/recurring-cost-calculator/recurring-answer";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

interface RecurringInputsProps {
  money: CalculatorMoney;
  fillable: FillableSchedule[];
  // The schedule that fills the amount, when one is chosen.
  schedule: FillableSchedule | undefined;
  // Minor units; null while the amount is missing.
  amount: number | null;
  per: Per;
}

export function RecurringInputs({
  money,
  fillable,
  schedule,
  amount,
  per,
}: RecurringInputsProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <>
      {fillable.length > 0 && (
        <Field necessity="none">
          <FieldLabel>{t("calc.recurring.schedule")}</FieldLabel>
          <ChoiceSelect
            label={t("calc.recurring.schedule")}
            choices={[
              { value: "", label: t("calc.recurring.schedule.none") },
              ...fillable.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={schedule?.id ?? ""}
            multiple={false}
            onChange={(next) => {
              set(
                typeof next === "string" && next !== ""
                  ? { schedule: next, amount: undefined, per: undefined }
                  : { schedule: undefined },
              );
            }}
          />
        </Field>
      )}

      <AmountField
        label={t("calc.recurring.amount")}
        width="medium"
        value={amount === null ? undefined : String(amount)}
        money={money}
        onChange={(v) => {
          set({
            amount: v,
            per: per === "year" ? "year" : undefined,
            schedule: undefined,
          });
        }}
      >
        {schedule !== undefined && (
          <FilledNote
            origin={t("calc.recurring.origin", { name: schedule.name })}
          />
        )}
      </AmountField>

      <ChoiceField
        label={t("calc.recurring.per")}
        choices={[
          { value: "month", label: t("calc.recurring.per.month") },
          { value: "year", label: t("calc.recurring.per.year") },
        ]}
        value={per}
        onChange={(next) => {
          set({
            per: next === "year" ? "year" : undefined,
            schedule: undefined,
            ...(amount === null ? {} : { amount: String(amount) }),
          });
        }}
      />

      <CountField
        label={t("calc.recurring.years")}
        unit={t("calc.unit.years")}
        name="years"
        width="short"
        value={search.years ?? ""}
        onChange={(v) => {
          set({ years: v });
        }}
      />
    </>
  );
}
