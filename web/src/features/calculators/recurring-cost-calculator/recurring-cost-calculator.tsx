import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  readInt,
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/recurring-cost-calculator/address-keys";
import { fillableSchedules } from "@/features/calculators/recurring-cost-calculator/fillable-schedules";
import { recurringAnswer } from "@/features/calculators/recurring-cost-calculator/recurring-answer";
import { RecurringAnswerView } from "@/features/calculators/recurring-cost-calculator/recurring-answer-view";
import { RecurringEvidence } from "@/features/calculators/recurring-cost-calculator/recurring-evidence";
import { RecurringInputs } from "@/features/calculators/recurring-cost-calculator/recurring-inputs";
import { RecurringOptional } from "@/features/calculators/recurring-cost-calculator/recurring-optional";
import { schedulesQuery } from "@/features/planning";
import { useT } from "@/i18n/i18n-provider";

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
  const [search] = useCalculatorSearch(addressKeys);
  const schedules = useQuery(schedulesQuery(api)).data ?? [];
  const method = <CalculatorMethod id="recurring-cost" sources={sources} />;

  if (money === null)
    return (
      <CalculatorFrame
        id="recurring-cost"
        inputs={null}
        results={null}
        method={method}
      />
    );

  const fillable = fillableSchedules(schedules, money.currency);
  const schedule = fillable.find((s) => s.id === search.schedule);
  const amount = schedule?.amount ?? readMinor(search.amount);
  const per = schedule?.per ?? (search.per === "year" ? "year" : "month");
  const years = readInt(search.years, 1, maxYears);
  const rate = "rate" in search ? readRate(search.rate) : null;
  const answer = recurringAnswer({ amount, per, years, rate });

  return (
    <CalculatorFrame
      id="recurring-cost"
      answer={
        <RecurringAnswerView
          money={money}
          answer={answer}
          amount={amount}
          per={per}
          years={years}
          rate={rate}
          missing={[
            {
              label: t("calc.recurring.amount"),
              missing: amount === null,
            },
            { label: t("calc.recurring.years"), missing: years === null },
          ]}
        />
      }
      evidence={
        answer.kind === "solved" && answer.futureValue !== null ? (
          <RecurringEvidence
            money={money}
            total={answer.total}
            futureValue={answer.futureValue}
          />
        ) : undefined
      }
      inputs={
        <RecurringInputs
          money={money}
          fillable={fillable}
          schedule={schedule}
          amount={amount}
          per={per}
        />
      }
      optional={<RecurringOptional />}
      method={method}
    />
  );
}
