import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import {
  addressKeys,
  choices,
} from "@/features/calculators/debt-payoff-calculator/address-keys";
import { debtAnswer } from "@/features/calculators/debt-payoff-calculator/debt-answer";
import { DebtAnswerView } from "@/features/calculators/debt-payoff-calculator/debt-answer-view";
import { DebtEvidence } from "@/features/calculators/debt-payoff-calculator/debt-evidence";
import { readDebts } from "@/features/calculators/debt-payoff-calculator/debt-input";
import { DebtInputs } from "@/features/calculators/debt-payoff-calculator/debt-inputs";
import { debtRateQuote } from "@/features/calculators/debt-payoff-calculator/debt-region";
import { useDebtRows } from "@/features/calculators/debt-payoff-calculator/use-debt-rows";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  readMinor,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";

const sources: Source[] = [
  {
    title:
      "Kellogg School of Management, The Snowball Approach to Debt (Gal and McShane 2012)",
    url: "https://www.kellogg.northwestern.edu/news_articles/2012/snowball-approach.aspx",
  },
];

// Design §5, debt-payoff: the avalanche and the snowball side by side over the same debts and
// budget, with the month each debt closes (study §3.3, E3).
export function DebtPayoffCalculator() {
  const t = useT();
  const { locale: profile } = useAppLocaleState();
  const money = useCalculatorMoney();
  const [search] = useCalculatorSearch(addressKeys);
  const { rows, owed, setRows } = useDebtRows(money?.currency ?? null);
  const method = <CalculatorMethod id="debt-payoff" sources={sources} />;

  if (money === null)
    return (
      <CalculatorFrame
        id="debt-payoff"
        inputs={null}
        results={null}
        method={method}
      />
    );

  const quote = debtRateQuote(profile.region);
  const period =
    choices.ratePeriod.find((p) => p === search.ratePeriod) ?? quote.period;
  const budget = readMinor(search.budget);
  const debts = readDebts(rows, period, quote.nominal);
  const answer = debtAnswer(debts, budget);

  return (
    <CalculatorFrame
      id="debt-payoff"
      answer={
        <DebtAnswerView
          money={money}
          answer={answer}
          missing={[
            { label: t("calc.debt.budget"), missing: budget === null },
            { label: t("calc.debt.list"), missing: debts === null },
          ]}
        />
      }
      evidence={
        (answer.kind === "solved" || answer.kind === "open") &&
        debts !== null ? (
          <DebtEvidence money={money} answer={answer} debts={debts} />
        ) : undefined
      }
      inputs={
        <DebtInputs
          money={money}
          quote={quote}
          period={period}
          rows={rows}
          owed={owed}
          setRows={setRows}
        />
      }
      method={method}
    />
  );
}
