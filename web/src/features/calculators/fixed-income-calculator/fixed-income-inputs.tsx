import { AmountField } from "@/features/calculators/fields/amount-field";
import { ChoiceField } from "@/features/calculators/fields/choice-field";
import { DurationField } from "@/features/calculators/fields/duration-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  addressKeys,
  choices,
} from "@/features/calculators/fixed-income-calculator/address-keys";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { unitPatch } from "@/features/calculators/model/duration";
import { RateSourceFields } from "@/features/calculators/rate-source/rate-source-fields";
import type { useRateSource } from "@/features/calculators/rate-source/use-rate-source";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

const dayUnits = choices.daysUnit;

interface FixedIncomeInputsProps {
  money: CalculatorMoney;
  rate: ReturnType<typeof useRateSource>;
  daysUnit: (typeof dayUnits)[number];
  // The days held; null while the term is not valid.
  days: number | null;
  exempt: boolean;
  // The region has no rule, so the person types the tax rate.
  askTax: boolean;
}

export function FixedIncomeInputs({
  money,
  rate,
  daysUnit,
  days,
  exempt,
  askTax,
}: FixedIncomeInputsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const count = numberFormatter(tag);
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <>
      <AmountField
        label={t("calc.fixedIncome.amount")}
        width="medium"
        value={search.amount}
        money={money}
        onChange={(v) => {
          set({ amount: v });
        }}
      />

      <RateSourceFields
        label={t("calc.fixedIncome.rate")}
        hint={t("calc.compound.rate.hint")}
        sourceLabel={t("calc.fixedIncome.rateSource")}
        source={rate}
        set={set}
      />

      <DurationField
        compact
        label={t("calc.fixedIncome.days")}
        hint={
          daysUnit !== "day" && days !== null
            ? t("calc.fixedIncome.days.equivalent", {
                days: count.format(days),
              })
            : t("calc.fixedIncome.days.hint")
        }
        name="days"
        value={search.days ?? ""}
        onChange={(v) => {
          set({ days: v });
        }}
        unit={daysUnit}
        units={dayUnits}
        onUnitChange={(u) => {
          set(unitPatch("days", search.days, daysUnit, u, dayUnits));
        }}
      />

      <ChoiceField
        label={t("calc.fixedIncome.kind")}
        help={`${t("calc.fixedIncome.taxable.help")} ${t("calc.fixedIncome.exempt.help")}`}
        choices={[
          { value: "taxable", label: t("calc.fixedIncome.kind.taxable") },
          { value: "exempt", label: t("calc.fixedIncome.kind.exempt") },
        ]}
        value={exempt ? "exempt" : "taxable"}
        onChange={(next) => {
          set({ kind: next === "exempt" ? "exempt" : undefined });
        }}
      />

      {askTax && (
        <RateField
          label={t("calc.fixedIncome.taxRate")}
          name="taxRate"
          value={search.taxRate ?? ""}
          onChange={(v) => {
            set({ taxRate: v });
          }}
        />
      )}
    </>
  );
}
