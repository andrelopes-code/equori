import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import { sources } from "@/features/calculators/compound-calculator/compound-sources";
import {
  balanceSpending,
  livingIncome,
  realMonthlyRate,
} from "@/features/calculators/compound-calculator/compound-answer";
import { IncomeAdjust } from "@/features/calculators/compound-calculator/income-adjust";
import { IncomeAnswer } from "@/features/calculators/compound-calculator/income-answer";
import { IncomeDetails } from "@/features/calculators/compound-calculator/income-details";
import { IncomeInputs } from "@/features/calculators/compound-calculator/income-inputs";
import { IncomeResults } from "@/features/calculators/compound-calculator/income-results";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import {
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import {
  incomeEvolution,
  REINVESTED_SHARE,
} from "@/features/calculators/model/compound-math";
import { readMonths, readUnit } from "@/features/calculators/model/duration";
import { annualToMonthly } from "@/features/calculators/model/rate-math";
import { incomeTermUnits } from "@/features/calculators/compound-calculator/income-inputs";
import { withdrawUnits } from "@/features/calculators/compound-calculator/use-accumulation";

const maxMonths = 1200;

// Design §5, compound, mode "live on income": the income that keeps the balance, and the balance
// earning each month with a share of the income reinvested and the rest spent.
export function IncomeCalculator() {
  const money = useCalculatorMoney();
  const [search] = useCalculatorSearch();

  const unit = readUnit(search.monthsUnit, incomeTermUnits);
  const months = readMonths(search.months, unit, 1, maxMonths);
  const period = search.period === "month" ? "month" : "year";
  const typed = readRate(search.rate);
  const j =
    typed === null ? null : period === "month" ? typed : annualToMonthly(typed);
  const balance = readMinor(search.initial);
  const share =
    search.share === undefined ? REINVESTED_SHARE : readShare(search.share);
  const inflation = readRate(search.inflation);
  const withdrawUnit = readUnit(search.withdrawUnit, withdrawUnits);
  const withdraw = readMonths(search.withdraw, withdrawUnit, 1, maxMonths);

  if (money === null)
    return <CalculatorFrame id="compound" inputs={null} method={null} />;

  // The balance keeps its purchasing power at the return net of inflation, so the rows and the
  // answer state the same income, in today's money.
  const net = j === null ? null : realMonthlyRate(j, inflation);
  const ready =
    balance !== null &&
    balance > 0 &&
    net !== null &&
    net > 0 &&
    months !== null &&
    share !== null;
  const rows = ready ? incomeEvolution(balance, net, share, months) : null;
  const lasting = ready
    ? livingIncome({ balance, j: j ?? 0, inflation, months, share })
    : null;
  const spending =
    balance !== null && j !== null && withdraw !== null
      ? balanceSpending({ balance, j, inflation, withdraw })
      : null;

  return (
    <CalculatorFrame
      id="compound"
      answer={
        <IncomeAnswer
          rows={rows}
          lasting={lasting}
          share={share ?? REINVESTED_SHARE}
          missing={{
            balance: balance === null || balance === 0,
            rate: j === null || j <= 0,
            term: months === null,
            share: share === null,
          }}
          money={money}
        />
      }
      evidence={
        rows === null ? undefined : (
          <IncomeResults
            rows={rows}
            spending={spending}
            inflation={inflation !== null}
            money={money}
          />
        )
      }
      inputs={<IncomeInputs money={money} />}
      optional={<IncomeAdjust />}
      details={
        rows === null ? undefined : <IncomeDetails rows={rows} money={money} />
      }
      method={
        <CalculatorMethod id="compound" sources={sources} noIndexes={false} />
      }
    />
  );
}

// A share of the income typed in percent, from 0 to 100, as a fraction; null when out of range.
function readShare(text: string): number | null {
  const share = readRate(text);

  return share !== null && share >= 0 && share <= 1 ? share : null;
}
