import {
  annualToMonthly,
  monthlyToAnnual,
  realRate,
} from "@/features/calculators/model/rate-math";

interface RatesAnswerInput {
  // A fraction of the typed period; null while the rate is missing or invalid.
  rate: number | null;
  period: "month" | "year";
  inflation: number | null;
  // The annual rate of the chosen index, already computed.
  ofIndex: number | null;
}

interface RatesAnswer {
  // The rate of the period the reader did not type.
  equivalent: number | null;
  // The annual rate after inflation.
  real: number | null;
  ofIndex: number | null;
}

export function ratesAnswer(input: RatesAnswerInput): RatesAnswer {
  const { rate, period, inflation, ofIndex } = input;
  if (rate === null) return { equivalent: null, real: null, ofIndex };

  const annual = period === "month" ? monthlyToAnnual(rate) : rate;

  return {
    equivalent: period === "month" ? annual : annualToMonthly(rate),
    real: inflation === null ? null : realRate(annual, inflation),
    ofIndex,
  };
}
