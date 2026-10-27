import { Field, FieldLabel } from "@slotted/react/field";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { AmountField } from "@/features/calculators/amount-field";
import { indexRatesQuery } from "@/features/calculators/api";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readMinor,
  readMonth,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { formatRate } from "@/features/calculators/format-rate";
import { accumulated } from "@/features/calculators/index-rates";
import type { Source } from "@/features/calculators/method-section";
import { ResultList } from "@/features/calculators/result-list";
import { roundHalfEven } from "@/features/calculators/round";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useIndexes } from "@/features/calculators/use-index-rate";
import { shiftMonth } from "@/features/overview";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { MonthControl } from "@/ui/month-control";

const sources: Source[] = [
  {
    title:
      "Banco Central do Brasil, Calculadora do Cidadão: correção de valores",
    url: "https://www3.bcb.gov.br/CALCIDADAO/jsp/index.jsp",
  },
  {
    title: "Banco Central do Brasil, Sistema Gerenciador de Séries Temporais",
    url: "https://www3.bcb.gov.br/sgspub/",
  },
];

function lastDay(month: string): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
}

// Design §5, correction: an amount carried from one month to another by the product of the
// index's rates of every month between them, both included (M7).
export function CorrectionCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const indexes = useIndexes();
  const index = indexes.find((i) => i.id === search.index) ?? indexes[0];
  const first = index?.first.slice(0, 7);
  const last = index?.last.slice(0, 7);
  // Without months in the address, the last 12 stored months.
  const from =
    readMonth(search.from) ??
    (last === undefined ? null : shiftMonth(last, -11));
  const to = readMonth(search.to) ?? last ?? null;
  const amount = readMinor(search.amount);
  const ordered = from !== null && to !== null && from <= to;
  const inRange =
    ordered &&
    first !== undefined &&
    last !== undefined &&
    from >= first &&
    to <= last;
  const rates = useQuery({
    ...indexRatesQuery(
      api,
      index?.id ?? "",
      from === null ? "" : `${from}-01`,
      to === null ? "" : lastDay(to),
    ),
    enabled: index !== undefined && inRange,
  }).data;

  if (money === null)
    return (
      <CalculatorFrame
        id="correction"
        inputs={null}
        results={null}
        method={null}
      />
    );

  let results = null;
  if (index === undefined)
    results = <Text size="sm">{t("calc.noIndexes")}</Text>;
  else if (from !== null && to !== null && !ordered)
    results = <Text size="sm">{t("calc.correction.order")}</Text>;
  else if (!inRange && first !== undefined && last !== undefined)
    results = (
      <Text size="sm">
        {t("calc.correction.range", {
          first: formatReferenceMonth(first, locale),
          last: formatReferenceMonth(last, locale),
        })}
      </Text>
    );
  else if (amount !== null && rates !== undefined && rates.length > 0) {
    const change = accumulated(rates);
    const months = new Set(rates.map((r) => r.date.slice(0, 7))).size;
    results = (
      <ResultList
        results={[
          {
            label: t("calc.correction.corrected"),
            value: money.format(roundHalfEven(amount * (1 + change))),
          },
          {
            label: t("calc.correction.factor"),
            value: new Intl.NumberFormat(locale, {
              minimumFractionDigits: 8,
              maximumFractionDigits: 8,
            }).format(1 + change),
          },
          {
            label: t("calc.correction.percent"),
            value: formatRate(change, locale),
          },
          { label: t("calc.correction.months"), value: String(months) },
        ]}
      />
    );
  }

  const inputs = (
    <>
      <AmountField
        label={t("calc.correction.amount")}
        value={search.amount}
        money={money}
        onChange={(v) => {
          set({ amount: v });
        }}
      />
      {index !== undefined && (
        <>
          <Field>
            <FieldLabel>{t("calc.index")}</FieldLabel>
            <ChoiceSelect
              label={t("calc.index")}
              choices={indexes.map((i) => ({
                value: i.id,
                label: i.id.toUpperCase(),
              }))}
              value={index.id}
              multiple={false}
              onChange={(next) => {
                if (typeof next === "string") set({ index: next });
              }}
            />
          </Field>
          {from !== null && (
            <Field>
              <FieldLabel>{t("calc.correction.from")}</FieldLabel>
              <MonthControl
                label={t("calc.correction.from")}
                value={from}
                onChange={(m) => {
                  set({ from: m });
                }}
              />
            </Field>
          )}
          {to !== null && (
            <Field>
              <FieldLabel>{t("calc.correction.to")}</FieldLabel>
              <MonthControl
                label={t("calc.correction.to")}
                value={to}
                onChange={(m) => {
                  set({ to: m });
                }}
              />
            </Field>
          )}
        </>
      )}
    </>
  );

  return (
    <CalculatorFrame
      id="correction"
      inputs={inputs}
      results={results}
      method={
        <CalculatorMethod
          id="correction"
          sources={sources}
          noIndexes={indexes.length === 0}
        />
      }
    />
  );
}
