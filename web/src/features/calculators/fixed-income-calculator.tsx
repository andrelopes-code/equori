import { Field, FieldLabel } from "@slotted/react/field";
import { Text } from "@slotted/react/typography";

import { AmountField } from "@/features/calculators/amount-field";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readInt,
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { CountField } from "@/features/calculators/count-field";
import {
  equivalentExempt,
  equivalentTaxable,
  fixedIncome,
} from "@/features/calculators/fixed-income-math";
import { fixedIncomeRules } from "@/features/calculators/fixed-income-region";
import { formatRate } from "@/features/calculators/format-rate";
import { RateField } from "@/features/calculators/rate-field";
import { RateSourceFields } from "@/features/calculators/rate-source-fields";
import { ResultList } from "@/features/calculators/result-list";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useRateSource } from "@/features/calculators/use-rate-source";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

// Twenty years of days: the longest holding the index history covers.
const maxDays = 7320;

// Design §5, fixed-income: the yield of a security after the tax of the person's region
// (design §7), and the rate of the other kind that leaves the same yield.
export function FixedIncomeCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const { locale: profile } = useAppLocaleState();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const rate = useRateSource(search, "rate");
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
  const days = readInt(search.days, 1, maxDays);
  const exempt = search.kind === "exempt";
  const typedTax = readRate(search.taxRate);
  // basis points of the tax on the yield, from the region's rule or the person's input.
  const taxBp =
    days === null
      ? null
      : rules !== null
        ? rules.taxBp(days)
        : typedTax === null || typedTax < 0 || typedTax >= 1
          ? null
          : Math.round(typedTax * 10000);

  let results = null;
  if (rules !== null && days !== null && days < rules.minimumDays)
    results = <Text size="sm">{t("calc.fixedIncome.iof")}</Text>;
  else if (
    amount !== null &&
    amount > 0 &&
    days !== null &&
    rate.annual !== null &&
    taxBp !== null
  ) {
    const got = fixedIncome({
      amount,
      annualRate: rate.annual,
      days,
      taxBp: exempt ? 0 : taxBp,
    });
    results = (
      <ResultList
        results={[
          {
            label: t("calc.fixedIncome.gross"),
            value: money.format(got.gross),
          },
          { label: t("calc.fixedIncome.tax"), value: money.format(got.tax) },
          { label: t("calc.fixedIncome.net"), value: money.format(got.net) },
          {
            label: t("calc.fixedIncome.netRate"),
            value: formatRate(got.netAnnualRate, locale),
          },
          {
            label: t("calc.fixedIncome.taxShare"),
            value: formatRate(taxBp / 10000, locale),
          },
          exempt
            ? {
                label: t("calc.fixedIncome.equivalentTaxable"),
                value: formatRate(
                  equivalentTaxable(rate.annual, taxBp),
                  locale,
                ),
              }
            : {
                label: t("calc.fixedIncome.equivalentExempt"),
                value: formatRate(equivalentExempt(rate.annual, taxBp), locale),
              },
        ]}
      />
    );
  }

  const inputs = (
    <>
      <AmountField
        label={t("calc.fixedIncome.amount")}
        value={search.amount}
        money={money}
        onChange={(v) => {
          set({ amount: v });
        }}
      />
      <RateSourceFields
        label={t("calc.fixedIncome.rate")}
        sourceLabel={t("calc.fixedIncome.rateSource")}
        source={rate}
        set={set}
      />
      <CountField
        label={t("calc.fixedIncome.days")}
        name="days"
        value={search.days ?? ""}
        onChange={(v) => {
          set({ days: v });
        }}
      />
      <Field>
        <FieldLabel>{t("calc.fixedIncome.kind")}</FieldLabel>
        <ChoiceSelect
          label={t("calc.fixedIncome.kind")}
          choices={[
            { value: "taxable", label: t("calc.fixedIncome.kind.taxable") },
            { value: "exempt", label: t("calc.fixedIncome.kind.exempt") },
          ]}
          value={exempt ? "exempt" : "taxable"}
          multiple={false}
          onChange={(next) => {
            set({ kind: next === "exempt" ? "exempt" : undefined });
          }}
        />
      </Field>
      {rules === null && (
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

  return (
    <CalculatorFrame
      id="fixed-income"
      inputs={inputs}
      results={results}
      method={method}
    />
  );
}
