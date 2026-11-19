import { CompoundModeField } from "@/features/calculators/compound-calculator/compound-mode-field";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { DurationField } from "@/features/calculators/fields/duration-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { readUnit, unitPatch } from "@/features/calculators/model/duration";
import type { DurationUnit } from "@/features/calculators/model/duration";
import { useT } from "@/i18n/i18n-provider";

// A life on the income lasts years more often than months.
export const incomeTermUnits: readonly DurationUnit[] = ["year", "month"];

interface IncomeInputsProps {
  money: CalculatorMoney;
}

export function IncomeInputs({ money }: IncomeInputsProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch();
  const unit = readUnit(search.monthsUnit, incomeTermUnits);
  const period = search.period === "month" ? "month" : "year";

  return (
    <>
      <CompoundModeField />

      <AmountField
        label={t("calc.compound.live.balance")}
        hint={t("calc.compound.live.balance.hint")}
        value={search.initial}
        money={money}
        onChange={(v) => {
          set({ initial: v });
        }}
      />

      <RateField
        compact
        label={t("calc.compound.rate")}
        help={t("calc.compound.rate.help")}
        name="rate"
        value={search.rate ?? ""}
        onChange={(v) => {
          set({ rate: v });
        }}
        period={period}
        onPeriodChange={(p) => {
          set({ period: p === "month" ? "month" : undefined });
        }}
      />

      <RateField
        compact
        label={t("calc.compound.live.share")}
        hint={t("calc.compound.live.share.hint")}
        name="share"
        value={search.share ?? ""}
        onChange={(v) => {
          set({ share: v });
        }}
      />

      <DurationField
        compact
        label={t("calc.compound.live.term")}
        hint={t("calc.compound.live.term.hint")}
        name="months"
        value={search.months ?? ""}
        onChange={(v) => {
          set({ months: v });
        }}
        unit={unit}
        units={incomeTermUnits}
        onUnitChange={(u) => {
          set(unitPatch("months", search.months, unit, u, incomeTermUnits));
        }}
      />
    </>
  );
}
