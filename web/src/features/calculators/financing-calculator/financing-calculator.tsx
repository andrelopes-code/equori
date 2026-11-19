import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  priceSchedule,
  sacSchedule,
} from "@/features/calculators/financing-calculator/annuity";
import { FinancingAnswerView } from "@/features/calculators/financing-calculator/financing-answer-view";
import { FinancingDetails } from "@/features/calculators/financing-calculator/financing-details";
import { FinancingEvidence } from "@/features/calculators/financing-calculator/financing-evidence";
import { readFinancing } from "@/features/calculators/financing-calculator/financing-input";
import { FinancingInputs } from "@/features/calculators/financing-calculator/financing-inputs";
import { FinancingOptional } from "@/features/calculators/financing-calculator/financing-optional";
import { systemNames } from "@/features/calculators/financing-calculator/financing-region";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";

const sources: Source[] = [
  {
    title:
      "Banco Central do Brasil, Calculadora do Cidadão: financiamento com prestações fixas (CALFW0402)",
    url: "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas",
  },
];

// Design §5, financing: a loan in Price (M3) and in SAC (M4) side by side, any of its four
// figures solved from the other three, and what a prepayment changes.
export function FinancingCalculator() {
  const t = useT();
  const { locale } = useAppLocaleState();
  const money = useCalculatorMoney();
  const [search] = useCalculatorSearch();

  if (money === null)
    return <CalculatorFrame id="financing" inputs={null} method={null} />;

  const names = systemNames(locale.region);
  const input = readFinancing(search);
  const { solved } = input;
  const loan = solved !== null && solved.amount > 0 ? solved : null;
  const schedules =
    loan === null
      ? null
      : {
          price: priceSchedule(loan.amount, loan.rate, loan.months),
          sac: sacSchedule(loan.amount, loan.rate, loan.months),
        };

  return (
    <CalculatorFrame
      id="financing"
      answer={
        <FinancingAnswerView
          input={input}
          money={money}
          schedules={schedules}
        />
      }
      evidence={
        loan !== null && schedules !== null ? (
          <FinancingEvidence
            {...schedules}
            loan={loan}
            rateSolved={input.solve === "rate"}
            money={money}
          />
        ) : undefined
      }
      inputs={<FinancingInputs solve={input.solve} money={money} />}
      optional={<FinancingOptional money={money} />}
      details={
        schedules === null ? undefined : (
          <FinancingDetails {...schedules} money={money} />
        )
      }
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
