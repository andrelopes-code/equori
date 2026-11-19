import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import { addressKeys } from "@/features/calculators/cash-or-installments-calculator/address-keys";
import { cashAnswer } from "@/features/calculators/cash-or-installments-calculator/cash-answer";
import { CashAnswerView } from "@/features/calculators/cash-or-installments-calculator/cash-answer-view";
import { CashEvidence } from "@/features/calculators/cash-or-installments-calculator/cash-evidence";
import { CashInputs } from "@/features/calculators/cash-or-installments-calculator/cash-inputs";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  readInt,
  readMinor,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { useRateSource } from "@/features/calculators/rate-source/use-rate-source";
import { useT } from "@/i18n/i18n-provider";

const maxInstallments = 1200;

const sources: Source[] = [
  {
    title: "Resolução CMN nº 4.881, de 23 de dezembro de 2020",
    url: "https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf",
  },
  {
    title:
      "Stango and Zinman 2009, Exponential Growth Bias and Household Finance, Journal of Finance 64(6)",
    url: "https://doi.org/10.1111/j.1540-6261.2009.01518.x",
  },
];

// Design §5, cash-or-installments: the monthly rate an installment plan implies against the cash
// price, and what the installments are worth today at a rate the person chooses.
export function CashOrInstallmentsCalculator() {
  const t = useT();
  const money = useCalculatorMoney();
  const [search] = useCalculatorSearch(addressKeys);
  const count = readInt(search.count, 1, maxInstallments);
  // ADR 026 E8: one month per installment.
  const compare = useRateSource(search, "compare", count ?? 12);
  const method = (
    <CalculatorMethod
      id="cash-or-installments"
      sources={sources}
      noIndexes={compare.noIndexes}
    />
  );
  if (money === null)
    return (
      <CalculatorFrame
        id="cash-or-installments"
        inputs={null}
        results={null}
        method={method}
      />
    );

  const cash = readMinor(search.cash);
  const installment = readMinor(search.installment);
  const firstNow = search.first === "now";
  const answer = cashAnswer({
    cash,
    count,
    installment,
    firstNow,
    compareMonthly: compare.monthly,
  });

  return (
    <CalculatorFrame
      id="cash-or-installments"
      answer={
        <CashAnswerView
          money={money}
          answer={answer}
          compareMonthly={compare.monthly}
          missing={[
            {
              label: t("calc.cash.price"),
              missing: cash === null || cash <= 0,
            },
            { label: t("calc.cash.count"), missing: count === null },
            {
              label: t("calc.cash.installment"),
              missing: installment === null,
            },
            {
              label: t("calc.cash.compare"),
              missing: compare.monthly === null,
            },
          ]}
        />
      }
      evidence={
        answer === null || cash === null ? undefined : (
          <CashEvidence money={money} answer={answer} cash={cash} />
        )
      }
      inputs={
        <CashInputs money={money} compare={compare} firstNow={firstNow} />
      }
      method={method}
    />
  );
}
