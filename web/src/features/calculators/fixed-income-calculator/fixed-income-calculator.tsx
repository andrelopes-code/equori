import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  addressKeys,
  choices,
} from "@/features/calculators/fixed-income-calculator/address-keys";
import {
  fixedIncomeAnswer,
  taxBasisPoints,
} from "@/features/calculators/fixed-income-calculator/fixed-income-answer";
import { FixedIncomeAnswerView } from "@/features/calculators/fixed-income-calculator/fixed-income-answer-view";
import { FixedIncomeEvidence } from "@/features/calculators/fixed-income-calculator/fixed-income-evidence";
import { FixedIncomeInputs } from "@/features/calculators/fixed-income-calculator/fixed-income-inputs";
import { fixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";
import {
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { readDays, readUnit } from "@/features/calculators/model/duration";
import { useRateSource } from "@/features/calculators/rate-source/use-rate-source";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// Twenty years of days: the longest holding the index history covers.
const maxDays = 7320;
const dayUnits = choices.daysUnit;

// Design §5, fixed-income: the yield of a security after the tax of the person's region
// (design §7), and the rate of the other kind that leaves the same yield.
export function FixedIncomeCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const { locale: profile } = useAppLocaleState();
  const money = useCalculatorMoney();
  const [search] = useCalculatorSearch(addressKeys);
  const today = useToday();
  const daysUnit = readUnit(search.daysUnit, dayUnits);
  const days = readDays(search.days, daysUnit, today, maxDays);
  // ADR 026 E8: the days held, in months rounded up.
  const rate = useRateSource(
    search,
    "rate",
    days === null ? 12 : Math.max(1, Math.ceil((days * 12) / 365)),
  );
  const rules = fixedIncomeRules(profile.region);
  const method = (
    <CalculatorMethod
      id="fixed-income"
      sources={rules?.sources ?? []}
      noIndexes={rate.noIndexes}
      notes={
        rules === null
          ? []
          : [
              ...rules.notes.map((k) => t(k)),
              t("calc.fixedIncome.checked", {
                date: formatDate(rules.checkedOn, locale),
              }),
            ]
      }
    />
  );
  if (money === null)
    return (
      <CalculatorFrame
        id="fixed-income"
        inputs={null}
        results={null}
        method={method}
      />
    );

  const amount = readMinor(search.amount);
  const exempt = search.kind === "exempt";
  const typedTax = readRate(search.taxRate);
  const taxBp = taxBasisPoints(rules, days, typedTax);
  const answer = fixedIncomeAnswer({
    amount,
    annualRate: rate.annual,
    days,
    taxBp,
    exempt,
  });
  const belowMinimum =
    rules !== null && days !== null && days < rules.minimumDays;

  return (
    <CalculatorFrame
      id="fixed-income"
      answer={
        <FixedIncomeAnswerView
          money={money}
          answer={belowMinimum ? null : answer}
          days={days}
          belowMinimum={belowMinimum}
          missing={[
            {
              label: t("calc.fixedIncome.amount"),
              missing: amount === null || amount <= 0,
            },
            {
              label: t("calc.fixedIncome.rate"),
              missing: rate.annual === null,
            },
            { label: t("calc.fixedIncome.days"), missing: days === null },
            {
              label: t("calc.fixedIncome.taxRate"),
              missing: rules === null && taxBp === null,
            },
          ]}
        />
      }
      evidence={
        answer === null || belowMinimum ? undefined : (
          <FixedIncomeEvidence money={money} answer={answer} exempt={exempt} />
        )
      }
      inputs={
        <FixedIncomeInputs
          money={money}
          rate={rate}
          daysUnit={daysUnit}
          days={days}
          exempt={exempt}
          askTax={rules === null}
        />
      }
      method={method}
    />
  );
}
