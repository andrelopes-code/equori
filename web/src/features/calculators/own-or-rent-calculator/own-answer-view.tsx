import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import type {
  OwnAnswer,
  OwnInputKey,
} from "@/features/calculators/own-or-rent-calculator/own-answer";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface OwnAnswerViewProps {
  money: CalculatorMoney;
  answer: OwnAnswer;
}

const inputLabels: Record<OwnInputKey, MessageKey> = {
  price: "calc.own.price",
  rent: "calc.own.rent",
  riskFree: "calc.own.riskFree",
  propertyTax: "calc.own.propertyTax",
  maintenance: "calc.own.maintenanceRate",
  appreciation: "calc.own.appreciationRate",
  riskPremium: "calc.own.riskPremiumRate",
  deductibleTax: "calc.own.deductibleTax",
  mortgage: "calc.own.mortgage",
};

const leads: Record<"own" | "rent" | "equal", MessageKey> = {
  own: "calc.own.answer.leadOwn",
  rent: "calc.own.answer.leadRent",
  equal: "calc.own.answer.leadEqual",
};

export function OwnAnswerView({ money, answer }: OwnAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();

  if (answer.kind === "missing")
    return (
      <CalculatorAnswer
        lead={t("calc.own.same")}
        figure={null}
        sentence={
          missingSentence(
            answer.missing.map((key) => ({
              label: lowerFirst(t(inputLabels[key]), tag),
              missing: true,
            })),
            t("calc.own.answer.what"),
            t,
            tag,
          ) ?? ""
        }
      />
    );

  const own = money.format(answer.own);
  const rent = money.format(answer.rent);

  return (
    <CalculatorAnswer
      lead={t(leads[answer.lead])}
      figure={money.format(answer.difference)}
      sentence={t("calc.own.answer.sentence", { own, rent })}
      facts={[
        { term: t("calc.own.total"), value: own },
        { term: t("calc.own.rentYear"), value: rent },
      ]}
    />
  );
}
