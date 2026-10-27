import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";

import { AmountField } from "@/features/calculators/amount-field";
import {
  prepay,
  priceSchedule,
  sacSchedule,
  solvePrice,
} from "@/features/calculators/annuity";
import type { AmortizationRow } from "@/features/calculators/annuity";
import { CalcTable } from "@/features/calculators/calc-table";
import styles from "@/features/calculators/calculators.module.css";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readInt,
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { ChoiceField } from "@/features/calculators/choice-field";
import { CountField } from "@/features/calculators/count-field";
import {
  readMonths,
  readUnit,
  termUnits,
  unitPatch,
} from "@/features/calculators/duration";
import { DurationField } from "@/features/calculators/duration-field";
import { systemNames } from "@/features/calculators/financing-region";
import { formatRate } from "@/features/calculators/format-rate";
import type { Source } from "@/features/calculators/method-section";
import { RateField } from "@/features/calculators/rate-field";
import {
  annualToMonthly,
  monthlyToAnnual,
} from "@/features/calculators/rate-math";
import { ResultLead } from "@/features/calculators/result-lead";
import { ResultList } from "@/features/calculators/result-list";
import type { CalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";

type Solve = "installment" | "amount" | "rate" | "months";
const solves: readonly Solve[] = ["installment", "amount", "rate", "months"];
const maxMonths = 1200;

const sources: Source[] = [
  {
    title:
      "Banco Central do Brasil, Calculadora do Cidadão: financiamento com prestações fixas (CALFW0402)",
    url: "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas",
  },
];

const sum = (
  rows: readonly AmortizationRow[],
  pick: (r: AmortizationRow) => number,
) => rows.reduce((s, r) => s + pick(r), 0);

function scheduleRows(
  rows: readonly AmortizationRow[],
  money: CalculatorMoney,
) {
  return rows.map((r) => ({
    key: String(r.month),
    cells: [
      String(r.month),
      money.format(r.installment),
      money.format(r.interest),
      money.format(r.amortization),
      money.format(r.balance),
    ],
  }));
}

// Design §5, financing: a loan in Price (M3) and in SAC (M4) side by side, any of its four
// figures solved from the other three, and what a prepayment changes.
export function FinancingCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const { locale: profile } = useAppLocaleState();
  const names = systemNames(profile.region);
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  if (money === null)
    return (
      <CalculatorFrame
        id="financing"
        inputs={null}
        results={null}
        method={null}
      />
    );

  const monthsUnit = readUnit(search.monthsUnit, termUnits);
  const solve: Solve = solves.find((s) => s === search.solve) ?? "installment";
  const period = search.period === "month" ? "month" : "year";
  const rate = readRate(search.rate);
  const j =
    rate === null || rate < 0
      ? null
      : period === "month"
        ? rate
        : annualToMonthly(rate);
  const given = {
    amount:
      solve === "amount" ? undefined : (readMinor(search.amount) ?? undefined),
    rate: solve === "rate" ? undefined : (j ?? undefined),
    months:
      solve === "months"
        ? undefined
        : (readMonths(search.months, monthsUnit, 1, maxMonths) ?? undefined),
    installment:
      solve === "installment"
        ? undefined
        : (readMinor(search.installment) ?? undefined),
  };
  // Three figures given, and an amount or an installment above zero where given.
  const complete =
    Object.values(given).filter((v) => v !== undefined).length === 3 &&
    (given.amount ?? 1) > 0 &&
    (given.installment ?? 1) > 0;
  const solved = complete ? solvePrice(given) : null;

  let results = null;
  let details;
  if (complete && solved === null)
    results = (
      <InlineMessage tone="warning">
        {t("calc.financing.noSolution")}
      </InlineMessage>
    );
  else if (solved !== null && solved.amount > 0) {
    const price = priceSchedule(solved.amount, solved.rate, solved.months);
    const sac = sacSchedule(solved.amount, solved.rate, solved.months);
    const lead =
      solve === "amount"
        ? {
            label: t("calc.financing.solved.amount"),
            value: money.format(solved.amount),
          }
        : solve === "rate"
          ? {
              label: t("calc.financing.solved.rate"),
              value: formatRate(solved.rate, locale, { min: 4 }),
            }
          : solve === "months"
            ? {
                label: t("calc.financing.solved.months"),
                value: String(solved.months),
              }
            : {
                label: t(names.installment),
                value: money.format(solved.installment),
              };

    const month = readInt(search.prepayMonth, 1, maxMonths);
    const extra = readMinor(search.prepayAmount);
    const change =
      month === null || extra === null
        ? undefined
        : prepay(solved.amount, solved.rate, solved.months, month, extra);
    const figure = (pick: (rows: readonly AmortizationRow[]) => number) => [
      money.format(pick(price)),
      money.format(pick(sac)),
    ];
    const columns = [
      t("calc.financing.col.month"),
      t("calc.financing.col.installment"),
      t("calc.financing.col.interest"),
      t("calc.financing.col.amortization"),
      t("calc.financing.col.balance"),
    ];
    results = (
      <Stack gap={5}>
        <ResultLead
          label={lead.label}
          value={lead.value}
          summary={t("calc.financing.summary", {
            priceName: t(names.price),
            sacName: t(names.sac),
            price: money.format(price[0]?.installment ?? 0),
            sacFirst: money.format(sac[0]?.installment ?? 0),
            sacLast: money.format(sac.at(-1)?.installment ?? 0),
          })}
        />
        {solve === "rate" && (
          <ResultList
            results={[
              {
                label: t("calc.financing.solved.annual"),
                value: formatRate(monthlyToAnnual(solved.rate), locale),
              },
            ]}
          />
        )}
        <CalcTable
          caption={t(names.compare)}
          headers={[t("calc.financing.figure"), t(names.price), t(names.sac)]}
          rows={[
            {
              key: "first",
              cells: [
                t("calc.financing.first"),
                ...figure((r) => r[0]?.installment ?? 0),
              ],
            },
            {
              key: "last",
              cells: [
                t("calc.financing.last"),
                ...figure((r) => r.at(-1)?.installment ?? 0),
              ],
            },
            {
              key: "paid",
              cells: [
                t("calc.financing.paid"),
                ...figure((r) => sum(r, (x) => x.installment)),
              ],
            },
            {
              key: "interest",
              cells: [
                t("calc.financing.interest"),
                ...figure((r) => sum(r, (x) => x.interest)),
              ],
            },
          ]}
        />
        {change === null && (
          <InlineMessage tone="warning">
            {t("calc.financing.prepay.invalid")}
          </InlineMessage>
        )}
        {change !== null && change !== undefined && (
          <Stack gap={2}>
            <Text size="sm" weight="semibold">
              {t("calc.financing.prepay.title")}
            </Text>
            <ResultList
              label={t("calc.financing.prepay.title")}
              results={[
                {
                  label: t("calc.financing.prepay.balance"),
                  value: money.format(change.balance),
                },
                {
                  label: t("calc.financing.prepay.without"),
                  value: money.format(change.without.interest),
                },
                {
                  label: t("calc.financing.prepay.months"),
                  value: String(change.keepInstallment.months),
                },
                {
                  label: t("calc.financing.prepay.keepInstallmentInterest"),
                  value: money.format(change.keepInstallment.interest),
                },
                {
                  label: t("calc.financing.prepay.installment"),
                  value: money.format(change.keepTerm.installment),
                },
                {
                  label: t("calc.financing.prepay.keepTermInterest"),
                  value: money.format(change.keepTerm.interest),
                },
              ]}
            />
          </Stack>
        )}
      </Stack>
    );
    details = (
      <Stack gap={4}>
        <Heading level={2} size="md">
          {t("calc.financing.schedule")}
        </Heading>
        <div className={styles.pair}>
          <CalcTable
            long
            caption={t(names.priceTable)}
            headers={columns}
            rows={scheduleRows(price, money)}
          />
          <CalcTable
            long
            caption={t(names.sacTable)}
            headers={columns}
            rows={scheduleRows(sac, money)}
          />
        </div>
      </Stack>
    );
  }

  const inputs = (
    <>
      <ChoiceField
        label={t("calc.financing.solve")}
        hint={t("calc.financing.solve.hint")}
        choices={solves.map((s) => ({
          value: s,
          label: t(`calc.financing.solve.${s}`),
        }))}
        value={solve}
        onChange={(next) => {
          set({ solve: next === "installment" ? undefined : next });
        }}
      />
      {solve !== "amount" && (
        <AmountField
          label={t("calc.financing.amount")}
          value={search.amount}
          money={money}
          onChange={(v) => {
            set({ amount: v });
          }}
        />
      )}
      {solve !== "rate" && (
        <RateField
          label={t("calc.financing.rate")}
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
      )}
      {solve !== "months" && (
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
      )}
      {solve !== "installment" && (
        <AmountField
          label={t(names.installment)}
          hint={t("calc.financing.installment.hint")}
          value={search.installment}
          money={money}
          onChange={(v) => {
            set({ installment: v });
          }}
        />
      )}
    </>
  );

  const options = (
    <>
      <CountField
        label={t("calc.financing.prepayMonth")}
        hint={t("calc.financing.prepayMonth.hint")}
        name="prepayMonth"
        value={search.prepayMonth ?? ""}
        onChange={(v) => {
          set({ prepayMonth: v });
        }}
      />
      <AmountField
        label={t("calc.financing.prepayAmount")}
        value={search.prepayAmount}
        money={money}
        onChange={(v) => {
          set({ prepayAmount: v });
        }}
      />
    </>
  );

  return (
    <CalculatorFrame
      id="financing"
      inputs={inputs}
      options={options}
      results={results}
      details={details}
      method={
        <CalculatorMethod
          id="financing"
          sources={sources}
          notes={names.note === null ? [] : [t(names.note)]}
        />
      }
    />
  );
}
