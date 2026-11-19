import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/own-or-rent-calculator/address-keys";
import { ownAnswer } from "@/features/calculators/own-or-rent-calculator/own-answer";
import type { OwnRateKey } from "@/features/calculators/own-or-rent-calculator/own-answer";
import { OwnAnswerView } from "@/features/calculators/own-or-rent-calculator/own-answer-view";
import { OwnEvidence } from "@/features/calculators/own-or-rent-calculator/own-evidence";
import { OwnInputs } from "@/features/calculators/own-or-rent-calculator/own-inputs";
import { OwnOptional } from "@/features/calculators/own-or-rent-calculator/own-optional";

const sources: Source[] = [
  {
    title:
      "Himmelberg, Mayer and Sinai 2005, Assessing High House Prices: Bubbles, Fundamentals, and Misperceptions (NBER w11643)",
    url: "https://realestate.wharton.upenn.edu/wp-content/uploads/2017/03/522.pdf",
  },
];

const rateKeys = [
  "riskFree",
  "propertyTax",
  "maintenance",
  "appreciation",
  "riskPremium",
  "deductibleTax",
  "mortgage",
] as const;

// The deduction rates default to 0 while their group is closed.
const deductionKeys: ReadonlySet<OwnRateKey> = new Set([
  "deductibleTax",
  "mortgage",
]);

// Design §5, own-or-rent: the annual cost of owning a home in six components (study §3.5)
// against the annual rent.
export function OwnOrRentCalculator() {
  const money = useCalculatorMoney();
  const [search] = useCalculatorSearch(addressKeys);
  const method = <CalculatorMethod id="own-or-rent" sources={sources} />;

  if (money === null)
    return (
      <CalculatorFrame
        id="own-or-rent"
        inputs={null}
        answer={null}
        method={method}
      />
    );

  const rates = Object.fromEntries(
    rateKeys.map((key) => [
      key,
      deductionKeys.has(key) && search[key] === undefined
        ? 0
        : readRate(search[key]),
    ]),
  ) as Record<OwnRateKey, number | null>;
  const answer = ownAnswer({
    price: readMinor(search.price),
    rent: readMinor(search.rent),
    rates,
  });

  return (
    <CalculatorFrame
      id="own-or-rent"
      answer={<OwnAnswerView money={money} answer={answer} />}
      evidence={
        answer.kind === "solved" ? (
          <OwnEvidence money={money} answer={answer} />
        ) : undefined
      }
      inputs={<OwnInputs money={money} />}
      optional={<OwnOptional />}
      method={method}
    />
  );
}
