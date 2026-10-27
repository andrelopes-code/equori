import { Field, FieldLabel } from "@slotted/react/field";

import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { formatRate } from "@/features/calculators/format-rate";
import type { Source } from "@/features/calculators/method-section";
import { RateField } from "@/features/calculators/rate-field";
import {
  annualToMonthly,
  monthlyToAnnual,
  realRate,
} from "@/features/calculators/rate-math";
import { ResultList } from "@/features/calculators/result-list";
import type { Result } from "@/features/calculators/result-list";
import {
  useIndexes,
  useTrailingRate,
} from "@/features/calculators/use-index-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

const sources: Source[] = [
  {
    title: "Banco Central do Brasil, Calculadora do Cidadão",
    url: "https://www3.bcb.gov.br/CALCIDADAO/jsp/index.jsp",
  },
];

// Design §5, rates: a rate per month and per year (M5), after inflation (M6), and the annual
// rate of a percent of a daily index over its last 12 months.
export function RatesCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const [search, set] = useCalculatorSearch();
  const indexes = useIndexes();
  const daily = indexes.filter((i) => i.period === "day");
  const index = daily.find((i) => i.id === search.index);
  const percent = readRate(search.percent);
  const ofIndex = useTrailingRate(
    percent === null ? undefined : index,
    percent ?? 1,
  );

  const period = search.period === "month" ? "month" : "year";
  const rate = readRate(search.rate);
  const inflation = readRate(search.inflation);
  const rows: Result[] = [];
  if (rate !== null) {
    const annual = period === "month" ? monthlyToAnnual(rate) : rate;
    const monthly = period === "month" ? rate : annualToMonthly(rate);
    rows.push(
      { label: t("calc.rates.monthly"), value: formatRate(monthly, locale) },
      { label: t("calc.rates.annual"), value: formatRate(annual, locale) },
    );
    if (inflation !== null)
      rows.push({
        label: t("calc.rates.real"),
        value: formatRate(realRate(annual, inflation), locale),
      });
  }
  if (ofIndex !== null)
    rows.push({
      label: t("calc.rates.ofIndex"),
      value: formatRate(ofIndex.rate, locale),
    });

  const inputs = (
    <>
      <RateField
        label={t("calc.rates.rate")}
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
        label={t("calc.rates.inflation")}
        name="inflation"
        value={search.inflation ?? ""}
        onChange={(v) => {
          set({ inflation: v });
        }}
      />
      {daily.length > 0 && (
        <>
          <Field>
            <FieldLabel>{t("calc.index")}</FieldLabel>
            <ChoiceSelect
              label={t("calc.index")}
              choices={[
                { value: "", label: t("calc.index.none") },
                ...daily.map((i) => ({
                  value: i.id,
                  label: i.id.toUpperCase(),
                })),
              ]}
              value={index?.id ?? ""}
              multiple={false}
              onChange={(next) => {
                set({
                  index:
                    typeof next === "string" && next !== "" ? next : undefined,
                });
              }}
            />
          </Field>
          {index !== undefined && (
            <RateField
              label={t("calc.rates.percent")}
              name="percent"
              value={search.percent ?? ""}
              onChange={(v) => {
                set({ percent: v });
              }}
            />
          )}
        </>
      )}
    </>
  );

  return (
    <CalculatorFrame
      id="rates"
      inputs={inputs}
      results={rows.length === 0 ? null : <ResultList results={rows} />}
      method={
        <CalculatorMethod
          id="rates"
          sources={sources}
          noIndexes={indexes.length === 0}
        />
      }
    />
  );
}
