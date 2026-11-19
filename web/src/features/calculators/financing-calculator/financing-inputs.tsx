import { SolveGroup } from "@/features/calculators/calculator-frame/solve-group";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { DurationField } from "@/features/calculators/fields/duration-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { systemNames } from "@/features/calculators/financing-calculator/financing-region";
import { solves } from "@/features/calculators/financing-calculator/financing-input";
import type { Solve } from "@/features/calculators/financing-calculator/financing-input";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import {
  addressKeys,
  choices,
} from "@/features/calculators/financing-calculator/address-keys";
import {
  readUnit,
  termUnits,
  unitPatch,
} from "@/features/calculators/model/duration";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";

interface FinancingInputsProps {
  solve: Solve;
  money: CalculatorMoney;
}

export function FinancingInputs({ solve, money }: FinancingInputsProps) {
  const t = useT();
  const { locale } = useAppLocaleState();
  const [search, set] = useCalculatorSearch(addressKeys);

  const names = systemNames(locale.region);
  const monthsUnit = readUnit(search.monthsUnit, choices.monthsUnit);
  const period = search.period === "month" ? "month" : "year";

  function handleSolve(chosen: Solve) {
    set({ solve: chosen === "installment" ? undefined : chosen });
  }

  return (
    <>
      <SolveGroup
        legend={t("calc.solve.legend")}
        hint={t("calc.financing.solve.hint")}
        choices={solves.map((s) => ({
          value: s,
          label: t(`calc.financing.solve.${s}`),
        }))}
        value={solve}
        onChange={handleSolve}
      />

      {solve !== "amount" && (
        <AmountField
          label={t("calc.financing.amount")}
          value={search.amount}
          money={money}
          width="medium"
          onChange={(v) => {
            set({ amount: v });
          }}
        />
      )}

      {solve !== "rate" && (
        <RateField
          label={t("calc.financing.rate")}
          help={t("calc.financing.rate.help")}
          name="rate"
          value={search.rate ?? ""}
          onChange={(v) => {
            set({ rate: v });
          }}
          compact
          period={period}
          onPeriodChange={(p) => {
            set({ period: p === "month" ? "month" : undefined });
          }}
        />
      )}

      {solve !== "months" && (
        <DurationField
          label={t("calc.term")}
          name="months"
          value={search.months ?? ""}
          onChange={(v) => {
            set({ months: v });
          }}
          compact
          unit={monthsUnit}
          units={termUnits}
          onUnitChange={(u) => {
            set(unitPatch("months", search.months, monthsUnit, u));
          }}
        />
      )}

      {solve !== "installment" && (
        <AmountField
          label={t(names.installment)}
          hint={t("calc.financing.installment.hint")}
          value={search.installment}
          money={money}
          width="medium"
          onChange={(v) => {
            set({ installment: v });
          }}
        />
      )}
    </>
  );
}
