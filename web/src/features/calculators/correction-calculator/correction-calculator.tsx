import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { indexRatesQuery } from "@/features/calculators/api";
import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import { addressKeys } from "@/features/calculators/correction-calculator/address-keys";
import {
  correctionAnswer,
  monthsStatus,
} from "@/features/calculators/correction-calculator/correction-answer";
import { CorrectionAnswerView } from "@/features/calculators/correction-calculator/correction-answer-view";
import { CorrectionInputs } from "@/features/calculators/correction-calculator/correction-inputs";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  readMinor,
  readMonth,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { useIndexes } from "@/features/calculators/rate-source/use-index-rate";
import { shiftMonth } from "@/features/overview";

const sources: Source[] = [
  {
    title:
      "Banco Central do Brasil, Calculadora do Cidadão: correção de valores",
    url: "https://www3.bcb.gov.br/CALCIDADAO/jsp/index.jsp",
  },
  {
    title: "Banco Central do Brasil, Sistema Gerenciador de Séries Temporais",
    url: "https://www3.bcb.gov.br/sgspub/",
  },
];

function lastDay(month: string): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
}

// Design §5, correction: an amount carried from one month to another by the product of the
// index's rates of every month between them, both included (M7).
export function CorrectionCalculator() {
  const api = useApi();
  const money = useCalculatorMoney();
  const [search] = useCalculatorSearch(addressKeys);
  const indexes = useIndexes();
  const index = indexes.find((i) => i.id === search.index) ?? indexes[0];
  const first = index?.first.slice(0, 7);
  const last = index?.last.slice(0, 7);
  // Without months in the address, the last 12 stored months.
  const from =
    readMonth(search.from) ??
    (last === undefined ? null : shiftMonth(last, -11));
  const to = readMonth(search.to) ?? last ?? null;
  const amount = readMinor(search.amount);
  const status = monthsStatus(from, to, first, last);
  const rates = useQuery({
    ...indexRatesQuery(
      api,
      index?.id ?? "",
      from === null ? "" : `${from}-01`,
      to === null ? "" : lastDay(to),
    ),
    enabled: index !== undefined && status === "inside",
  }).data;

  if (money === null)
    return (
      <CalculatorFrame
        id="correction"
        inputs={null}
        answer={null}
        method={null}
      />
    );

  const answer = correctionAnswer(amount, rates);

  return (
    <CalculatorFrame
      id="correction"
      answer={
        <CorrectionAnswerView
          money={money}
          amount={amount}
          index={index}
          from={from}
          to={to}
          status={status}
          answer={answer}
        />
      }
      inputs={
        <CorrectionInputs
          money={money}
          indexes={indexes}
          index={index?.id}
          from={from}
          to={to}
        />
      }
      method={
        <CalculatorMethod
          id="correction"
          sources={sources}
          noIndexes={indexes.length === 0}
        />
      }
    />
  );
}
