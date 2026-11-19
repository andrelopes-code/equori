import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import { addressKeys } from "@/features/calculators/credit-cost-calculator/address-keys";
import { creditAnswer } from "@/features/calculators/credit-cost-calculator/credit-answer";
import { CreditAnswerView } from "@/features/calculators/credit-cost-calculator/credit-answer-view";
import { CreditDetails } from "@/features/calculators/credit-cost-calculator/credit-details";
import { CreditEvidence } from "@/features/calculators/credit-cost-calculator/credit-evidence";
import { CreditInputs } from "@/features/calculators/credit-cost-calculator/credit-inputs";
import { CreditOptional } from "@/features/calculators/credit-cost-calculator/credit-optional";
import { regionalTerms } from "@/features/calculators/credit-cost-calculator/credit-region";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  readDate,
  readInt,
  readMinor,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

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

// Design §5, credit-cost: the effective annual cost of an offer, from the flows of its
// installments and the fees paid upfront.
export function CreditCostCalculator() {
  const t = useT();
  const { locale: profile } = useAppLocaleState();
  const today = useToday();
  const money = useCalculatorMoney();
  const [search] = useCalculatorSearch(addressKeys);
  const terms = regionalTerms(profile.region);
  const method = (
    <CalculatorMethod
      id="credit-cost"
      sources={sources}
      notes={terms.note === null ? [] : [t(terms.note)]}
    />
  );

  if (money === null)
    return (
      <CalculatorFrame
        id="credit-cost"
        inputs={null}
        results={null}
        method={method}
      />
    );

  const released = readMinor(search.released);
  const installment = readMinor(search.installment);
  const count = readInt(search.count, 1, maxInstallments);
  const releaseDate = readDate(search.releaseDate) ?? today;
  const firstDue = readDate(search.firstDue);
  const answer = creditAnswer({
    released,
    fees: readMinor(search.fees) ?? 0,
    installment,
    count,
    releaseDate,
    firstDue,
  });

  return (
    <CalculatorFrame
      id="credit-cost"
      answer={
        <CreditAnswerView
          money={money}
          answer={answer}
          released={released}
          installment={installment}
          count={count}
          missing={[
            { label: t("calc.credit.released"), missing: released === null },
            { label: t("calc.credit.count"), missing: count === null },
            {
              label: t("calc.credit.installment"),
              missing: installment === null,
            },
            { label: t("calc.credit.firstDue"), missing: firstDue === null },
          ]}
        />
      }
      evidence={
        answer.kind === "solved" && released !== null ? (
          <CreditEvidence money={money} answer={answer} released={released} />
        ) : undefined
      }
      inputs={
        <CreditInputs
          money={money}
          releaseDate={releaseDate}
          firstDue={firstDue}
        />
      }
      optional={<CreditOptional money={money} />}
      details={
        answer.kind === "solved" ? (
          <CreditDetails money={money} flows={answer.flows} />
        ) : undefined
      }
      method={method}
    />
  );
}
