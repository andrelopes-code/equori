import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import { AccumulationAdjust } from "@/features/calculators/compound-calculator/accumulation-adjust";
import { AccumulationAnswer } from "@/features/calculators/compound-calculator/accumulation-answer";
import { AccumulationDetails } from "@/features/calculators/compound-calculator/accumulation-details";
import { AccumulationEvidence } from "@/features/calculators/compound-calculator/accumulation-evidence";
import { AccumulationInputs } from "@/features/calculators/compound-calculator/accumulation-inputs";
import { sources } from "@/features/calculators/compound-calculator/compound-sources";
import { useAccumulation } from "@/features/calculators/compound-calculator/use-accumulation";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";

// Design §5, compound: what an initial amount and monthly deposits reach (M1, M2), or the
// deposit that reaches a target, with the rate given or taken from a daily index.
export function AccumulationCalculator() {
  const money = useCalculatorMoney();
  const input = useAccumulation();

  if (money === null)
    return (
      <CalculatorFrame
        id="compound"
        inputs={null}
        answer={null}
        method={null}
      />
    );

  const { run } = input;

  return (
    <CalculatorFrame
      id="compound"
      answer={<AccumulationAnswer input={input} money={money} />}
      evidence={
        run === null ? undefined : (
          <AccumulationEvidence input={input} money={money} />
        )
      }
      inputs={<AccumulationInputs input={input} money={money} />}
      optional={<AccumulationAdjust input={input} />}
      details={
        run === null ? undefined : (
          <AccumulationDetails
            initial={input.initial}
            deposit={run.deposit}
            j={run.j}
            months={run.months}
            money={money}
          />
        )
      }
      method={
        <CalculatorMethod
          id="compound"
          sources={sources}
          noIndexes={input.indexes.length === 0}
        />
      }
    />
  );
}
