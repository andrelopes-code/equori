import { Field, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { AmountField } from "@/features/calculators/amount-field";
import {
  prepay,
  priceSchedule,
  sacSchedule,
  solvePrice,
} from "@/features/calculators/annuity";
import type { AmortizationRow } from "@/features/calculators/annuity";
import { CalcTable } from "@/features/calculators/calc-table";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readInt,
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { CountField } from "@/features/calculators/count-field";
import { formatRate } from "@/features/calculators/format-rate";
import type { Source } from "@/features/calculators/method-section";
import { RateField } from "@/features/calculators/rate-field";
import {
  annualToMonthly,
  monthlyToAnnual,
} from "@/features/calculators/rate-math";
import { ResultList } from "@/features/calculators/result-list";
import type { Result } from "@/features/calculators/result-list";
import type { CalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

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
        : (readInt(search.months, 1, maxMonths) ?? undefined),
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
  if (complete && solved === null)
    results = <Text size="sm">{t("calc.financing.noSolution")}</Text>;
  else if (solved !== null && solved.amount > 0) {
    const price = priceSchedule(solved.amount, solved.rate, solved.months);
    const sac = sacSchedule(solved.amount, solved.rate, solved.months);
    const solvedRows: Result[] = [];
    if (solve === "amount")
      solvedRows.push({
        label: t("calc.financing.solved.amount"),
        value: money.format(solved.amount),
      });
    if (solve === "rate")
      solvedRows.push(
        {
          label: t("calc.financing.solved.rate"),
          value: formatRate(solved.rate, locale, { min: 4 }),
        },
        {
          label: t("calc.financing.solved.annual"),
          value: formatRate(monthlyToAnnual(solved.rate), locale),
        },
      );
    if (solve === "months")
      solvedRows.push({
        label: t("calc.financing.solved.months"),
        value: String(solved.months),
      });
    if (solve === "installment")
      solvedRows.push({
        label: t("calc.financing.solved.installment"),
        value: money.format(solved.installment),
      });

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
        <ResultList results={solvedRows} />
        <CalcTable
          caption={t("calc.financing.compare")}
          headers={[
            t("calc.financing.figure"),
            t("calc.financing.price"),
            t("calc.financing.sac"),
          ]}
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
          <Text size="sm">{t("calc.financing.prepay.invalid")}</Text>
        )}
        {change !== null && change !== undefined && (
          <ResultList
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
        )}
        <CalcTable
          caption={t("calc.financing.priceTable")}
          headers={columns}
          rows={scheduleRows(price, money)}
        />
        <CalcTable
          caption={t("calc.financing.sacTable")}
          headers={columns}
          rows={scheduleRows(sac, money)}
        />
      </Stack>
    );
  }

  const inputs = (
    <>
      <Field>
        <FieldLabel>{t("calc.financing.solve")}</FieldLabel>
        <ChoiceSelect
          label={t("calc.financing.solve")}
          choices={solves.map((s) => ({
            value: s,
            label: t(`calc.financing.solve.${s}`),
          }))}
          value={solve}
          multiple={false}
          onChange={(next) => {
            set({
              solve:
                next === "installment" || typeof next !== "string"
                  ? undefined
                  : next,
            });
          }}
        />
      </Field>
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
        <CountField
          label={t("calc.months")}
          name="months"
          value={search.months ?? ""}
          onChange={(v) => {
            set({ months: v });
          }}
        />
      )}
      {solve !== "installment" && (
        <AmountField
          label={t("calc.financing.installment")}
          value={search.installment}
          money={money}
          onChange={(v) => {
            set({ installment: v });
          }}
        />
      )}
      <CountField
        label={t("calc.financing.prepayMonth")}
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
      results={results}
      method={<CalculatorMethod id="financing" sources={sources} />}
    />
  );
}
