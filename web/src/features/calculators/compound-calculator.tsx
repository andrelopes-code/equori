import type { ChartSeries } from "@slotted/core/chart";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Chart } from "@slotted/react/chart";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";

import { AmountField } from "@/features/calculators/amount-field";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import styles from "@/features/calculators/calculators.module.css";
import {
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import {
  balances,
  depositForTarget,
  depositsValue,
  futureValue,
  monthlyIncome,
} from "@/features/calculators/compound-math";
import { ChoiceField } from "@/features/calculators/choice-field";
import { FilledNote } from "@/features/calculators/filled-note";
import {
  clearFloating,
  floatingKeys,
  readFloating,
} from "@/features/calculators/floating";
import { FloatingFields } from "@/features/calculators/floating-fields";
import { floatingOrigin } from "@/features/calculators/floating-origin";
import { indexName } from "@/features/calculators/index-catalog";
import { IndexChoice } from "@/features/calculators/index-choice";
import { rateText } from "@/features/calculators/format-rate";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import type { Source } from "@/features/calculators/method-section";
import { RateField } from "@/features/calculators/rate-field";
import {
  convertMonthsText,
  readMonths,
  readUnit,
  termUnits,
  unitPatch,
} from "@/features/calculators/duration";
import type { DurationUnit } from "@/features/calculators/duration";
import { DurationField } from "@/features/calculators/duration-field";
import {
  annualToMonthly,
  monthlyToAnnual,
} from "@/features/calculators/rate-math";
import { ResultLead } from "@/features/calculators/result-lead";
import { ResultList } from "@/features/calculators/result-list";
import type { Result } from "@/features/calculators/result-list";
import { roundHalfEven } from "@/features/calculators/round";
import { useSimulation } from "@/features/calculators/use-simulation";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import {
  useIndexes,
  useIndexRate,
} from "@/features/calculators/use-index-rate";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

const maxMonths = 1200;
// A withdrawal lasts years more often than months.
const withdrawUnits: readonly DurationUnit[] = ["year", "month"];
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
  const floating = readFloating(search, floatingKeys, index?.id ?? "");
  const fromIndex = useIndexRate(index, floating);
  const inflationIndex = monthly.find((i) => i.id === search.inflationIndex);
  const fromInflationIndex = useIndexRate(inflationIndex);

  const target = search.mode === "target";
  const period = search.period === "month" ? "month" : "year";
  const typed = readRate(search.rate);
  const annual =
    index === undefined
      ? typed !== null && period === "month"
        ? monthlyToAnnual(typed)
        : typed
      : floating.value === null
        ? null
        : (fromIndex?.rate ?? null);
  const inflation =
    inflationIndex === undefined
      ? readRate(search.inflation)
      : (fromInflationIndex?.rate ?? null);
  const monthsUnit = readUnit(search.monthsUnit, termUnits);
  const months = readMonths(search.months, monthsUnit, 1, maxMonths);
  const delayUnit = readUnit(search.delayUnit, termUnits);
  const delay =
    search.delay === undefined
      ? defaultDelay
      : readMonths(search.delay, delayUnit, 0, maxMonths);
  const initial = readMinor(search.initial) ?? 0;
  const goal = readMinor(search.target);
  const j = annual === null ? null : annualToMonthly(annual);
  const deposit =
    j === null || months === null
      ? null
      : target
        ? goal === null
          ? null
          : depositForTarget(goal, initial, j, months)
        : (readMinor(search.deposit) ?? 0);
  const withdrawUnit = readUnit(search.withdrawUnit, withdrawUnits);
  const withdraw = readMonths(search.withdraw, withdrawUnit, 1, maxMonths);
  // Empty by default: no source gives a volatility (design §2, anti-goals).
  const volatility = readRate(search.volatility);
  const range = useSimulation(initial, deposit, months, annual, volatility);

  if (money === null)
    return (
      <CalculatorFrame
        id="compound"
        inputs={null}
        results={null}
        method={null}
      />
    );

  let results = null;
  let details;
  if (j !== null && months !== null && deposit !== null) {
    const final =
      futureValue(initial, j, months) + depositsValue(deposit, j, months);
    const deposited = initial + deposit * months;
    const rows: Result[] = [];
    if (target)
      rows.push({
        label: t("calc.compound.final"),
        value: money.format(final),
      });
    rows.push(
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
    if (range !== null)
      rows.push(
        { label: t("calc.compound.p10"), value: money.format(range.p10) },
        { label: t("calc.compound.p50"), value: money.format(range.p50) },
        { label: t("calc.compound.p90"), value: money.format(range.p90) },
      );
    // The income of the final amount, from the month after the term (design §5, compound).
    const g = inflation === null ? 0 : annualToMonthly(inflation);
    const lasting = monthlyIncome(final, j, g);
    const spending =
      withdraw === null ? null : monthlyIncome(final, j, g, withdraw);
    const today = (v: number) =>
      inflation === null
        ? v
        : roundHalfEven(v / (1 + inflation) ** (months / 12));
    const income: Result[] = [];
    if (lasting !== null)
      income.push(
        {
          label: t(
            inflation === null
              ? "calc.compound.income.lasting"
              : "calc.compound.income.lastingToday",
          ),
          value: money.format(today(lasting)),
        },
        ...(inflation === null
          ? []
          : [
              {
                label: t("calc.compound.income.lastingAtEnd"),
                value: money.format(lasting),
              },
            ]),
      );
    if (spending !== null)
      income.push({
        label: t(
          inflation === null
            ? "calc.compound.income.spending"
            : "calc.compound.income.spendingToday",
        ),
        value: money.format(today(spending)),
      });
    results = (
      <Stack gap={5}>
        {target ? (
          <ResultLead
            label={t("calc.compound.depositNeeded")}
            value={money.format(deposit)}
            summary={t("calc.compound.targetSummary", {
              months,
              target: money.format(final),
            })}
          />
        ) : (
          <ResultLead
            label={t("calc.compound.final")}
            value={money.format(final)}
            summary={t("calc.compound.summary", {
              deposited: money.format(deposited),
              months,
              interest: money.format(final - deposited),
            })}
          />
        )}
        <ResultList results={rows} />
        <Stack gap={3}>
          <Heading level={2} size="md">
            {t("calc.compound.income")}
          </Heading>
          {lasting === null && (
            <Alert tone="warning">
              <AlertContent>
                <AlertDescription>
                  {t("calc.compound.income.none")}
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}
          {income.length > 0 && (
            <ResultList label={t("calc.compound.income")} results={income} />
          )}
          <Text size="sm" tone="muted">
            {t(
              inflation === null
                ? "calc.compound.income.nominalNote"
                : "calc.compound.income.realNote",
            )}
          </Text>
        </Stack>
      </Stack>
    );
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
    details = (
      <Stack gap={2}>
        <Chart
          variant="card"
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
      <ChoiceField
        label={t("calc.compound.mode")}
        choices={[
          { value: "final", label: t("calc.compound.mode.final") },
          { value: "target", label: t("calc.compound.mode.target") },
        ]}
        value={target ? "target" : "final"}
        onChange={(next) => {
          set({ mode: next === "target" ? "target" : undefined });
        }}
      />
      <div className={styles.pair}>
        <AmountField
          label={t("calc.compound.initial")}
          hint={t("calc.compound.initial.hint")}
          value={search.initial}
          money={money}
          onChange={(v) => {
            set({ initial: v });
          }}
        />
        {target ? (
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
      </div>
      <DurationField
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
          floating={floating}
          keys={floatingKeys}
          percentLabel={t("calc.compound.percent")}
          set={set}
        />
      )}
      <RateField
        label={t("calc.compound.rate")}
        {...(index === undefined ? { hint: t("calc.compound.rate.hint") } : {})}
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
              )}
            />
          )}
      </RateField>
    </>
  );

  const options = (
    <>
      <RateField
        label={t("calc.compound.inflation")}
        hint={t("calc.compound.inflation.hint")}
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
              index: indexName(inflationIndex.id),
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
                  variant="outline"
                  tone="secondary"
                  onClick={() => {
                    set({ inflationIndex: i.id, inflation: undefined });
                  }}
                >
                  {t("calc.useIndex", { index: indexName(i.id) })}
                </Button>
              ))}
            </Inline>
          )
        )}
      </RateField>
      <DurationField
        label={t("calc.compound.delay")}
        hint={t("calc.compound.delay.hint")}
        name="delay"
        value={
          search.delay ??
          convertMonthsText(String(defaultDelay), "month", delayUnit)
        }
        onChange={(v) => {
          set({ delay: v });
        }}
        unit={delayUnit}
        units={termUnits}
        onUnitChange={(u) => {
          set(unitPatch("delay", search.delay, delayUnit, u));
        }}
      />
      <DurationField
        label={t("calc.compound.withdraw")}
        hint={t("calc.compound.withdraw.hint")}
        name="withdraw"
        value={search.withdraw ?? ""}
        onChange={(v) => {
          set({ withdraw: v });
        }}
        unit={withdrawUnit}
        units={withdrawUnits}
        onUnitChange={(u) => {
          set(
            unitPatch(
              "withdraw",
              search.withdraw,
              withdrawUnit,
              u,
              withdrawUnits,
            ),
          );
        }}
      />
      <RateField
        label={t("calc.compound.volatility")}
        hint={t("calc.compound.volatility.hint")}
        name="volatility"
        value={search.volatility ?? ""}
        onChange={(v) => {
          set({ volatility: v });
        }}
      />
    </>
  );

  return (
    <CalculatorFrame
      id="compound"
      inputs={inputs}
      options={options}
      results={
        results === null ? null : (
          <Stack gap={6}>
            {results}
            {details}
          </Stack>
        )
      }
      method={
        <CalculatorMethod
          id="compound"
          sources={sources}
          noIndexes={indexes.length === 0}
        />
      }
    />
  );
}
