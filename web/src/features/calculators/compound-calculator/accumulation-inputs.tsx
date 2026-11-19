import { CompoundModeField } from "@/features/calculators/compound-calculator/compound-mode-field";
import {
  clearFloating,
  floatingKeys,
} from "@/features/calculators/compound-calculator/use-accumulation";
import type { AccumulationInput } from "@/features/calculators/compound-calculator/use-accumulation";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { DurationField } from "@/features/calculators/fields/duration-field";
import { FilledNote } from "@/features/calculators/fields/filled-note";
import { RateField } from "@/features/calculators/fields/rate-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { termUnits, unitPatch } from "@/features/calculators/model/duration";
import { rateText } from "@/features/calculators/model/format-rate";
import { FloatingFields } from "@/features/calculators/rate-source/floating-fields";
import { floatingOrigin } from "@/features/calculators/rate-source/floating-origin";
import { IndexChoice } from "@/features/calculators/rate-source/index-choice";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AccumulationInputsProps {
  input: AccumulationInput;
  money: CalculatorMoney;
}

export function AccumulationInputs({ input, money }: AccumulationInputsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const [search, set] = useCalculatorSearch();
  const { index, floating, fromIndex, daily, period, monthsUnit } = input;

  return (
    <>
      <CompoundModeField />

      <AmountField
        label={t("calc.compound.initial")}
        hint={t("calc.compound.initial.hint")}
        value={search.initial}
        money={money}
        onChange={(v) => {
          set({ initial: v });
        }}
      />

      {input.target ? (
        <AmountField
          label={t("calc.compound.target")}
          hint={t("calc.compound.target.hint")}
          value={search.target}
          money={money}
          onChange={(v) => {
            set({ target: v });
          }}
        />
      ) : (
        <AmountField
          label={t("calc.compound.deposit")}
          hint={t("calc.compound.deposit.hint")}
          value={search.deposit}
          money={money}
          onChange={(v) => {
            set({ deposit: v });
          }}
        />
      )}

      <DurationField
        compact
        label={t("calc.term")}
        name="months"
        value={search.months ?? ""}
        onChange={(v) => {
          set({ months: v });
        }}
        unit={monthsUnit}
        units={termUnits}
        onUnitChange={(u) => {
          set(unitPatch("months", search.months, monthsUnit, u));
        }}
      />

      {daily.length > 0 && (
        <IndexChoice
          label={t("calc.compound.rateSource")}
          hint={t("calc.rateSource.hint")}
          none={t("calc.rateSource.fixed")}
          indexes={daily}
          value={index?.id}
          onChange={(next) => {
            set({
              ...clearFloating(floatingKeys),
              ...(next === undefined
                ? { index: undefined }
                : { index: next, rate: undefined }),
            });
          }}
        />
      )}

      {index !== undefined && (
        <FloatingFields
          indexId={index.id}
          expected={index.expected}
          floating={floating}
          keys={floatingKeys}
          percentLabel={t("calc.compound.percent")}
          set={set}
        />
      )}

      <RateField
        compact
        label={t("calc.compound.rate")}
        help={t("calc.compound.rate.help")}
        name="rate"
        value={
          index === undefined
            ? (search.rate ?? "")
            : fromIndex === null
              ? ""
              : rateText(fromIndex.rate)
        }
        onChange={(v) => {
          set({ ...clearFloating(floatingKeys), rate: v, index: undefined });
        }}
        {...(index === undefined
          ? {
              period,
              onPeriodChange: (p: "month" | "year") => {
                set({ period: p === "month" ? "month" : undefined });
              },
            }
          : {})}
      >
        {index !== undefined &&
          fromIndex !== null &&
          floating.value !== null && (
            <FilledNote
              origin={floatingOrigin(
                t,
                locale,
                index.id,
                { ...floating, value: floating.value },
                fromIndex.to,
                input.months ?? 12,
              )}
            />
          )}
      </RateField>
    </>
  );
}
