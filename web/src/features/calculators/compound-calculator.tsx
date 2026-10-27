import type { ChartSeries } from "@slotted/core/chart";
import { Button } from "@slotted/react/button";
import { Chart } from "@slotted/react/chart";
import { Field, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { AmountField } from "@/features/calculators/amount-field";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import {
  readInt,
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import {
  balances,
  depositForTarget,
  depositsValue,
  futureValue,
} from "@/features/calculators/compound-math";
import { CountField } from "@/features/calculators/count-field";
import { FilledNote } from "@/features/calculators/filled-note";
import { formatRate, rateText } from "@/features/calculators/format-rate";
import { MethodSection } from "@/features/calculators/method-section";
import type { Source } from "@/features/calculators/method-section";
import { RateField } from "@/features/calculators/rate-field";
import { annualToMonthly } from "@/features/calculators/rate-math";
import { ResultList } from "@/features/calculators/result-list";
import type { Result } from "@/features/calculators/result-list";
import { roundHalfEven } from "@/features/calculators/round";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import {
  useIndexes,
  useTrailingRate,
} from "@/features/calculators/use-index-rate";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

const maxMonths = 1200;
const defaultDelay = 12;

const sources: Source[] = [
  {
    title:
      "Banco Central do Brasil, Calculadora do Cidadão: valor futuro de um capital (CALFW0502)",
    url: "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaValorFuturoCapital.do?method=exibirMetodologiaValorFuturoCapital",
  },
  {
    title:
      "Banco Central do Brasil, Calculadora do Cidadão: aplicação com depósitos regulares (CALFW0202)",
    url: "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaAplicacaoDepositosRegulares.do?method=exibirMetodologiaAplicacaoDepositosRegulares",
  },
  {
    title:
      "McKenzie and Liersch 2011, Misunderstanding Savings Growth, Journal of Marketing Research 48",
    url: "https://doi.org/10.1509/jmkr.48.SPL.S1",
  },
  {
    title:
      "Stango and Zinman 2009, Exponential Growth Bias and Household Finance, Journal of Finance 64(6)",
    url: "https://doi.org/10.1111/j.1540-6261.2009.01518.x",
  },
];

const steps: MessageKey[] = [
  "calc.compound.step1",
  "calc.compound.step2",
  "calc.compound.step3",
  "calc.compound.step4",
  "calc.compound.step5",
  "calc.compound.step6",
];
const formula: MessageKey[] = [
  "calc.compound.formula1",
  "calc.compound.formula2",
  "calc.compound.formula3",
  "calc.compound.formula4",
  "calc.compound.symbols",
];
const assumptions: MessageKey[] = [
  "calc.compound.assumption1",
  "calc.compound.assumption2",
  "calc.compound.assumption3",
  "calc.compound.assumption4",
];
const limits: MessageKey[] = [
  "calc.compound.limit1",
  "calc.compound.limit2",
  "calc.compound.limit3",
];

// Design §5, compound: what an initial amount and monthly deposits reach (M1, M2), or the
// deposit that reaches a target, with the rate given or taken from a daily index.
export function CompoundCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const indexes = useIndexes();
  const daily = indexes.filter((i) => i.period === "day");
  const monthly = indexes.filter((i) => i.period === "month");
  const index = daily.find((i) => i.id === search.index);
  const percent = readRate(search.percent ?? "100");
  const fromIndex = useTrailingRate(index, percent ?? 1);
  const inflationIndex = monthly.find((i) => i.id === search.inflationIndex);
  const fromInflationIndex = useTrailingRate(inflationIndex);

  const target = search.mode === "target";
  const annual =
    index === undefined
      ? readRate(search.rate)
      : percent === null
        ? null
        : (fromIndex?.rate ?? null);
  const inflation =
    inflationIndex === undefined
      ? readRate(search.inflation)
      : (fromInflationIndex?.rate ?? null);
  const months = readInt(search.months, 1, maxMonths);
  const delay =
    search.delay === undefined
      ? defaultDelay
      : readInt(search.delay, 0, maxMonths);
  const initial = readMinor(search.initial) ?? 0;
  const goal = readMinor(search.target);

  if (money === null)
    return (
      <CalculatorFrame
        id="compound"
        inputs={null}
        results={null}
        method={null}
      />
    );

  const j = annual === null ? null : annualToMonthly(annual);
  const deposit =
    j === null || months === null
      ? null
      : target
        ? goal === null
          ? null
          : depositForTarget(goal, initial, j, months)
        : (readMinor(search.deposit) ?? 0);

  let results = null;
  if (j !== null && months !== null && deposit !== null) {
    const final =
      futureValue(initial, j, months) + depositsValue(deposit, j, months);
    const deposited = initial + deposit * months;
    const rows: Result[] = [];
    if (target)
      rows.push({
        label: t("calc.compound.depositNeeded"),
        value: money.format(deposit),
      });
    rows.push(
      { label: t("calc.compound.final"), value: money.format(final) },
      { label: t("calc.compound.deposited"), value: money.format(deposited) },
      {
        label: t("calc.compound.interest"),
        value: money.format(final - deposited),
      },
    );
    if (inflation !== null)
      rows.push({
        label: t("calc.compound.real"),
        value: money.format(
          roundHalfEven(final / (1 + inflation) ** (months / 12)),
        ),
      });
    if (delay !== null) {
      const later = Math.max(months - delay, 0);
      const delayed =
        futureValue(initial, j, later) + depositsValue(deposit, j, later);
      rows.push(
        {
          label: t("calc.compound.delayed", { months: delay }),
          value: money.format(delayed),
        },
        {
          label: t("calc.compound.difference"),
          value: money.format(final - delayed),
        },
      );
    }
    const format = (v: number) => money.format(v);
    const series: ChartSeries[] = [
      {
        id: "balance",
        kind: "line",
        field: "balance",
        label: t("calc.compound.chart.balance"),
        format,
      },
      {
        id: "deposited",
        kind: "line",
        field: "deposited",
        label: t("calc.compound.chart.deposited"),
        format,
      },
    ];
    results = (
      <Stack gap={4}>
        <ResultList results={rows} />
        <Chart
          variant="card"
          size="sm"
          title={t("calc.compound.chart")}
          data={balances(initial, deposit, j, months).map((r) => ({
            label: t("calc.compound.chart.month", { month: r.month }),
            balance: r.balance,
            deposited: r.deposited,
          }))}
          series={series}
          x={{ field: "label" }}
          y={{ format }}
        />
        <Text size="sm" tone="muted">
          {t("calc.estimate")}
        </Text>
      </Stack>
    );
  }

  const inputs = (
    <>
      <Field>
        <FieldLabel>{t("calc.compound.mode")}</FieldLabel>
        <ChoiceSelect
          label={t("calc.compound.mode")}
          choices={[
            { value: "final", label: t("calc.compound.mode.final") },
            { value: "target", label: t("calc.compound.mode.target") },
          ]}
          value={target ? "target" : "final"}
          multiple={false}
          onChange={(next) => {
            set({ mode: next === "target" ? "target" : undefined });
          }}
        />
      </Field>
      <AmountField
        label={t("calc.compound.initial")}
        value={search.initial}
        money={money}
        onChange={(v) => {
          set({ initial: v });
        }}
      />
      {target ? (
        <AmountField
          label={t("calc.compound.target")}
          value={search.target}
          money={money}
          onChange={(v) => {
            set({ target: v });
          }}
        />
      ) : (
        <AmountField
          label={t("calc.compound.deposit")}
          value={search.deposit}
          money={money}
          onChange={(v) => {
            set({ deposit: v });
          }}
        />
      )}
      <CountField
        label={t("calc.months")}
        name="months"
        value={search.months ?? ""}
        onChange={(v) => {
          set({ months: v });
        }}
      />
      {daily.length > 0 && (
        <Field>
          <FieldLabel>{t("calc.compound.rateSource")}</FieldLabel>
          <ChoiceSelect
            label={t("calc.compound.rateSource")}
            choices={[
              { value: "", label: t("calc.rateSource.fixed") },
              ...daily.map((i) => ({ value: i.id, label: i.id.toUpperCase() })),
            ]}
            value={index?.id ?? ""}
            multiple={false}
            onChange={(next) => {
              set(
                typeof next === "string" && next !== ""
                  ? { index: next, rate: undefined }
                  : { index: undefined, percent: undefined },
              );
            }}
          />
        </Field>
      )}
      {index !== undefined && (
        <RateField
          label={t("calc.compound.percent")}
          name="percent"
          value={search.percent ?? "100"}
          onChange={(v) => {
            set({ percent: v });
          }}
        />
      )}
      <RateField
        label={t("calc.compound.rate")}
        name="rate"
        value={
          index === undefined
            ? (search.rate ?? "")
            : fromIndex === null
              ? ""
              : rateText(fromIndex.rate)
        }
        onChange={(v) => {
          set({ rate: v, index: undefined, percent: undefined });
        }}
      >
        {index !== undefined && fromIndex !== null && percent !== null && (
          <FilledNote
            origin={t("calc.origin.daily", {
              percent: formatRate(percent, locale),
              index: index.id.toUpperCase(),
              date: formatDate(fromIndex.to, locale),
            })}
          />
        )}
      </RateField>
      <RateField
        label={t("calc.compound.inflation")}
        name="inflation"
        value={
          inflationIndex === undefined
            ? (search.inflation ?? "")
            : fromInflationIndex === null
              ? ""
              : rateText(fromInflationIndex.rate)
        }
        onChange={(v) => {
          set({ inflation: v, inflationIndex: undefined });
        }}
      >
        {inflationIndex !== undefined && fromInflationIndex !== null ? (
          <FilledNote
            origin={t("calc.origin.monthly", {
              index: inflationIndex.id.toUpperCase(),
              date: formatDate(fromInflationIndex.to, locale),
            })}
          />
        ) : (
          monthly.length > 0 && (
            <Inline gap={2}>
              {monthly.map((i) => (
                <Button
                  key={i.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    set({ inflationIndex: i.id, inflation: undefined });
                  }}
                >
                  {t("calc.useIndex", { index: i.id.toUpperCase() })}
                </Button>
              ))}
            </Inline>
          )
        )}
      </RateField>
      <CountField
        label={t("calc.compound.delay")}
        name="delay"
        value={search.delay ?? String(defaultDelay)}
        onChange={(v) => {
          set({ delay: v });
        }}
      />
    </>
  );

  return (
    <CalculatorFrame
      id="compound"
      inputs={inputs}
      results={results}
      method={
        <MethodSection
          answers={t("calc.compound.question")}
          steps={steps.map((k) => t(k))}
          formula={formula.map((k) => t(k))}
          assumptions={assumptions.map((k) => t(k))}
          limits={limits.map((k) => t(k))}
          sources={sources}
        />
      }
    />
  );
}
