import { Field, FieldLabel } from "@slotted/react/field";
import { Text } from "@slotted/react/typography";

import { AmountField } from "@/features/calculators/amount-field";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readInt,
  readMinor,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { CountField } from "@/features/calculators/count-field";
import { impliedRate, presentValue } from "@/features/calculators/credit-math";
import { formatRate } from "@/features/calculators/format-rate";
import type { Source } from "@/features/calculators/method-section";
import { RateSourceFields } from "@/features/calculators/rate-source-fields";
import { monthlyToAnnual } from "@/features/calculators/rate-math";
import { ResultList } from "@/features/calculators/result-list";
import type { Result } from "@/features/calculators/result-list";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useRateSource } from "@/features/calculators/use-rate-source";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

const maxInstallments = 1200;

const sources: Source[] = [
  {
    title: "Resolução CMN nº 4.881, de 23 de dezembro de 2020",
    url: "https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf",
  },
  {
    title:
      "Stango and Zinman 2009, Exponential Growth Bias and Household Finance, Journal of Finance 64(6)",
    url: "https://doi.org/10.1111/j.1540-6261.2009.01518.x",
  },
];

// Design §5, cash-or-installments: the monthly rate an installment plan implies against the cash
// price, and what the installments are worth today at a rate the person chooses.
export function CashOrInstallmentsCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const compare = useRateSource(search, "compare");
  if (money === null)
    return (
      <CalculatorFrame
        id="cash-or-installments"
        inputs={null}
        results={null}
        method={null}
      />
    );

  const cash = readMinor(search.cash);
  const count = readInt(search.count, 1, maxInstallments);
  const installment = readMinor(search.installment);
  const firstNow = search.first === "now";

  let results = null;
  if (cash !== null && cash > 0 && count !== null && installment !== null) {
    const implied = impliedRate(cash, count, installment, firstNow);
    const rows: Result[] = [
      { label: t("calc.cash.total"), value: money.format(count * installment) },
    ];
    if (typeof implied === "number")
      rows.push(
        { label: t("calc.cash.monthly"), value: formatRate(implied, locale) },
        {
          label: t("calc.cash.annual"),
          value: formatRate(monthlyToAnnual(implied), locale),
        },
      );
    if (compare.monthly !== null) {
      const value = presentValue(count, installment, compare.monthly, firstNow);
      rows.push({
        label: t("calc.cash.presentValue"),
        value: money.format(value),
      });
      // A comparison states which figure is lower and by how much (design §2).
      rows.push({
        label: t(
          value > cash
            ? "calc.cash.cashLower"
            : value < cash
              ? "calc.cash.installmentsLower"
              : "calc.cash.same",
        ),
        value: money.format(Math.abs(value - cash)),
      });
    }
    results = (
      <>
        {implied === "no_interest" && (
          <Text size="sm">{t("calc.cash.noInterest")}</Text>
        )}
        {implied === null && <Text size="sm">{t("calc.cash.noSolution")}</Text>}
        <ResultList results={rows} />
      </>
    );
  }

  const inputs = (
    <>
      <AmountField
        label={t("calc.cash.price")}
        value={search.cash}
        money={money}
        onChange={(v) => {
          set({ cash: v });
        }}
      />
      <CountField
        label={t("calc.cash.count")}
        name="count"
        value={search.count ?? ""}
        onChange={(v) => {
          set({ count: v });
        }}
      />
      <AmountField
        label={t("calc.cash.installment")}
        value={search.installment}
        money={money}
        onChange={(v) => {
          set({ installment: v });
        }}
      />
      <Field>
        <FieldLabel>{t("calc.cash.first")}</FieldLabel>
        <ChoiceSelect
          label={t("calc.cash.first")}
          choices={[
            { value: "later", label: t("calc.cash.first.later") },
            { value: "now", label: t("calc.cash.first.now") },
          ]}
          value={firstNow ? "now" : "later"}
          multiple={false}
          onChange={(next) => {
            set({ first: next === "now" ? "now" : undefined });
          }}
        />
      </Field>
      <RateSourceFields
        label={t("calc.cash.compare")}
        sourceLabel={t("calc.cash.rateSource")}
        source={compare}
        set={set}
      />
    </>
  );

  return (
    <CalculatorFrame
      id="cash-or-installments"
      inputs={inputs}
      results={results}
      method={
        <CalculatorMethod
          id="cash-or-installments"
          sources={sources}
          noIndexes={compare.noIndexes}
        />
      }
    />
  );
}
