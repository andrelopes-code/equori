import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";

import { AmountField } from "@/features/calculators/amount-field";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { ChoiceField } from "@/features/calculators/choice-field";
import { readDays, readUnit, unitPatch } from "@/features/calculators/duration";
import type { DurationUnit } from "@/features/calculators/duration";
import { DurationField } from "@/features/calculators/duration-field";
import {
  equivalentExempt,
  equivalentTaxable,
  fixedIncome,
} from "@/features/calculators/fixed-income-math";
import { fixedIncomeRules } from "@/features/calculators/fixed-income-region";
import { formatRate } from "@/features/calculators/format-rate";
import { RateField } from "@/features/calculators/rate-field";
import { RateSourceFields } from "@/features/calculators/rate-source-fields";
import { ResultLead } from "@/features/calculators/result-lead";
import { ResultList } from "@/features/calculators/result-list";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useRateSource } from "@/features/calculators/use-rate-source";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/i18n/today";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";

// Twenty years of days: the longest holding the index history covers.
const maxDays = 7320;
const dayUnits: readonly DurationUnit[] = ["day", "month", "year"];

// Design §5, fixed-income: the yield of a security after the tax of the person's region
// (design §7), and the rate of the other kind that leaves the same yield.
export function FixedIncomeCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const { locale: profile } = useAppLocaleState();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const today = useToday();
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
  const daysUnit = readUnit(search.daysUnit, dayUnits);
  const days = readDays(search.days, daysUnit, today, maxDays);
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
    results = (
      <InlineMessage tone="warning">{t("calc.fixedIncome.iof")}</InlineMessage>
    );
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
      <Stack gap={5}>
        <ResultLead
          label={t("calc.fixedIncome.net")}
          value={money.format(got.net)}
          summary={t("calc.fixedIncome.summary", {
            gross: money.format(got.gross),
            tax: money.format(got.tax),
            share: formatRate(exempt ? 0 : taxBp / 10000, locale),
            days,
          })}
        />
        <ResultList
          results={[
            {
              label: t("calc.fixedIncome.gross"),
              value: money.format(got.gross),
            },
            { label: t("calc.fixedIncome.tax"), value: money.format(got.tax) },
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
                  value: formatRate(
                    equivalentExempt(rate.annual, taxBp),
                    locale,
                  ),
                },
          ]}
        />
      </Stack>
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
        hint={t("calc.compound.rate.hint")}
        sourceLabel={t("calc.fixedIncome.rateSource")}
        source={rate}
        set={set}
      />
      <DurationField
        label={t("calc.fixedIncome.days")}
        hint={
          daysUnit !== "day" && days !== null
            ? t("calc.fixedIncome.days.equivalent", { days: String(days) })
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
        hint={t("calc.fixedIncome.kind.hint")}
        choices={[
          { value: "taxable", label: t("calc.fixedIncome.kind.taxable") },
          { value: "exempt", label: t("calc.fixedIncome.kind.exempt") },
        ]}
        value={exempt ? "exempt" : "taxable"}
        onChange={(next) => {
          set({ kind: next === "exempt" ? "exempt" : undefined });
        }}
      />
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
