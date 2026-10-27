import { Field, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { AmountField } from "@/features/calculators/amount-field";
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
import { FilledNote } from "@/features/calculators/filled-note";
import type { Source } from "@/features/calculators/method-section";
import { recurringCost } from "@/features/calculators/plan-math";
import { RateField } from "@/features/calculators/rate-field";
import { ResultLead } from "@/features/calculators/result-lead";
import { ResultList } from "@/features/calculators/result-list";
import type { Result } from "@/features/calculators/result-list";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { schedulesQuery } from "@/features/planning";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

const maxYears = 100;

const sources: Source[] = [
  {
    title:
      "Banco Central do Brasil, Calculadora do Cidadão: aplicação com depósitos regulares (CALFW0202)",
    url: "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaAplicacaoDepositosRegulares.do?method=exibirMetodologiaAplicacaoDepositosRegulares",
  },
];

// Design §5, recurring-cost: the total of a recurring payment over the years, and what the same
// payments would reach as deposits at a rate (M2).
export function RecurringCostCalculator() {
  const t = useT();
  const api = useApi();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const schedules = useQuery(schedulesQuery(api)).data ?? [];
  if (money === null)
    return (
      <CalculatorFrame
        id="recurring-cost"
        inputs={null}
        results={null}
        method={null}
      />
    );

  // A schedule fills the amount of its latest terms when it recurs every month or every year in
  // the base currency.
  const fillable = schedules.flatMap((s) => {
    const terms = s.terms.at(-1);
    if (
      terms?.amount.currency !== money.currency ||
      terms.recurrence.interval !== 1
    )
      return [];
    const per =
      terms.recurrence.frequency === "monthly"
        ? "month"
        : terms.recurrence.frequency === "yearly"
          ? "year"
          : null;
    return per === null
      ? []
      : [
          {
            id: s.id,
            name: s.description,
            amount: Math.abs(terms.amount.amount),
            per,
          },
        ];
  });
  const schedule = fillable.find((s) => s.id === search.schedule);
  const amount = schedule?.amount ?? readMinor(search.amount);
  const per = schedule?.per ?? (search.per === "year" ? "year" : "month");
  const years = readInt(search.years, 1, maxYears);
  const rate = readRate(search.rate);

  let results = null;
  if (amount !== null && years !== null) {
    const got = recurringCost(amount, per === "month" ? 12 : 1, years, rate);
    const rows: Result[] = [];
    if (got.futureValue !== null)
      rows.push(
        {
          label: t("calc.recurring.futureValue"),
          value: money.format(got.futureValue),
        },
        {
          label: t("calc.recurring.difference"),
          value: money.format(got.futureValue - got.total),
        },
      );
    results = (
      <Stack gap={5}>
        <ResultLead
          label={t("calc.recurring.total")}
          value={money.format(got.total)}
          summary={t(
            per === "month"
              ? "calc.recurring.summaryMonth"
              : "calc.recurring.summaryYear",
            { amount: money.format(amount), years },
          )}
        />
        {rows.length > 0 && <ResultList results={rows} />}
      </Stack>
    );
  }

  const inputs = (
    <>
      {fillable.length > 0 && (
        <Field>
          <FieldLabel>{t("calc.recurring.schedule")}</FieldLabel>
          <ChoiceSelect
            label={t("calc.recurring.schedule")}
            choices={[
              { value: "", label: t("calc.recurring.schedule.none") },
              ...fillable.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={schedule?.id ?? ""}
            multiple={false}
            onChange={(next) => {
              set(
                typeof next === "string" && next !== ""
                  ? { schedule: next, amount: undefined, per: undefined }
                  : { schedule: undefined },
              );
            }}
          />
        </Field>
      )}
      <AmountField
        label={t("calc.recurring.amount")}
        value={amount === null ? undefined : String(amount)}
        money={money}
        onChange={(v) => {
          set({
            amount: v,
            per: per === "year" ? "year" : undefined,
            schedule: undefined,
          });
        }}
      >
        {schedule !== undefined && (
          <FilledNote
            origin={t("calc.recurring.origin", { name: schedule.name })}
          />
        )}
      </AmountField>
      <ChoiceField
        label={t("calc.recurring.per")}
        choices={[
          { value: "month", label: t("calc.recurring.per.month") },
          { value: "year", label: t("calc.recurring.per.year") },
        ]}
        value={per}
        onChange={(next) => {
          set({
            per: next === "year" ? "year" : undefined,
            schedule: undefined,
            ...(amount === null ? {} : { amount: String(amount) }),
          });
        }}
      />
      <CountField
        label={t("calc.recurring.years")}
        unit={t("calc.unit.years")}
        name="years"
        value={search.years ?? ""}
        onChange={(v) => {
          set({ years: v });
        }}
      />
    </>
  );

  const options = (
    <RateField
      label={t("calc.recurring.rate")}
      hint={t("calc.recurring.rate.hint")}
      name="rate"
      value={search.rate ?? ""}
      onChange={(v) => {
        set({ rate: v });
      }}
    />
  );

  return (
    <CalculatorFrame
      id="recurring-cost"
      inputs={inputs}
      options={options}
      results={results}
      method={<CalculatorMethod id="recurring-cost" sources={sources} />}
    />
  );
}
