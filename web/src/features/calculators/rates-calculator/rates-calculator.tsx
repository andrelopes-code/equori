import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import {
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/rates-calculator/address-keys";
import { RatesAnswerView } from "@/features/calculators/rates-calculator/rates-answer-view";
import { ratesAnswer } from "@/features/calculators/rates-calculator/rates-answer";
import { RatesInputs } from "@/features/calculators/rates-calculator/rates-inputs";
import { RatesOptional } from "@/features/calculators/rates-calculator/rates-optional";
import {
  floatingKeys,
  readFloating,
} from "@/features/calculators/rate-source/floating";
import {
  useIndexes,
  useIndexRate,
} from "@/features/calculators/rate-source/use-index-rate";

const sources: Source[] = [
  {
    title: "Banco Central do Brasil, Calculadora do Cidadão",
    url: "https://www3.bcb.gov.br/CALCIDADAO/jsp/index.jsp",
  },
];

// Design §5, rates: a rate per month and per year (M5), after inflation (M6), and the annual
// rate of a percent of a daily index over its last 12 months.
export function RatesCalculator() {
  const [search] = useCalculatorSearch(addressKeys);
  const indexes = useIndexes();
  const daily = indexes.filter((i) => i.period === "day");
  const index = daily.find((i) => i.id === search.index);
  const floating = readFloating(
    search,
    floatingKeys,
    index?.id ?? "",
    index?.expected ?? false,
  );
  const ofIndex = useIndexRate(index, floating);

  const period = search.period === "month" ? "month" : "year";
  const rate = readRate(search.rate);
  const answer = ratesAnswer({
    rate,
    period,
    inflation: readRate(search.inflation),
    ofIndex: ofIndex === null ? null : ofIndex.rate,
  });

  return (
    <CalculatorFrame
      id="rates"
      answer={<RatesAnswerView answer={answer} rate={rate} period={period} />}
      inputs={<RatesInputs period={period} />}
      optional={
        <RatesOptional daily={daily} index={index} floating={floating} />
      }
      method={
        <CalculatorMethod
          id="rates"
          sources={sources}
          noIndexes={indexes.length === 0}
        />
      }
    />
  );
}
