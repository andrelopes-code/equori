import { Stack } from "@slotted/react/stack";

import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import {
  clearFloating,
  floatingKeys,
  readFloating,
} from "@/features/calculators/floating";
import { FloatingFields } from "@/features/calculators/floating-fields";
import { formatRate } from "@/features/calculators/format-rate";
import { IndexChoice } from "@/features/calculators/index-choice";
import type { Source } from "@/features/calculators/method-section";
import { RateField } from "@/features/calculators/rate-field";
import {
  annualToMonthly,
  monthlyToAnnual,
  realRate,
} from "@/features/calculators/rate-math";
import { ResultLead } from "@/features/calculators/result-lead";
import { ResultList } from "@/features/calculators/result-list";
import type { Result } from "@/features/calculators/result-list";
import {
  useIndexes,
  useTrailingRate,
} from "@/features/calculators/use-index-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

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
  const floating = readFloating(search, floatingKeys, index?.id ?? "");
  const ofIndex = useTrailingRate(index, floating);

  const period = search.period === "month" ? "month" : "year";
  const rate = readRate(search.rate);
  const inflation = readRate(search.inflation);
  let results = null;
  const rows: Result[] = [];
  if (rate !== null) {
    const annual = period === "month" ? monthlyToAnnual(rate) : rate;
    const monthly = period === "month" ? rate : annualToMonthly(rate);
    // The lead is the rate of the period the reader did not type; the typed one follows it.
    const ofMonth = {
      label: t("calc.rates.monthly"),
      value: formatRate(monthly, locale),
    };
    const ofYear = {
      label: t("calc.rates.annual"),
      value: formatRate(annual, locale),
    };
    rows.push(period === "month" ? ofMonth : ofYear);
    if (inflation !== null)
      rows.push({
        label: t("calc.rates.real"),
        value: formatRate(realRate(annual, inflation), locale),
      });
    if (ofIndex !== null)
      rows.push({
        label: t("calc.rates.ofIndex"),
        value: formatRate(ofIndex.rate, locale),
      });
    results = (
      <Stack gap={5}>
        <ResultLead {...(period === "month" ? ofYear : ofMonth)} />
        <ResultList results={rows} />
      </Stack>
    );
  } else if (ofIndex !== null)
    results = (
      <ResultLead
        label={t("calc.rates.ofIndex")}
        value={formatRate(ofIndex.rate, locale)}
      />
    );

  const inputs = (
    <RateField
      label={t("calc.rates.rate")}
      hint={t("calc.rates.rate.hint")}
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
  );

  const options = (
    <>
      <RateField
        label={t("calc.rates.inflation")}
        hint={t("calc.rates.inflation.hint")}
        name="inflation"
        value={search.inflation ?? ""}
        onChange={(v) => {
          set({ inflation: v });
        }}
      />
      {daily.length > 0 && (
        <IndexChoice
          label={t("calc.index")}
          hint={t("calc.rates.index.hint")}
          none={t("calc.index.none")}
          indexes={daily}
          value={index?.id}
          onChange={(next) => {
            set({ ...clearFloating(floatingKeys), index: next });
          }}
        />
      )}
      {index !== undefined && (
        <FloatingFields
          indexId={index.id}
          floating={floating}
          keys={floatingKeys}
          percentLabel={t("calc.rates.percent")}
          set={set}
        />
      )}
    </>
  );

  return (
    <CalculatorFrame
      id="rates"
      inputs={inputs}
      options={options}
      results={results}
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
