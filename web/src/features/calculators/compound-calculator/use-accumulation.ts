import { accumulationResult } from "@/features/calculators/compound-calculator/accumulation-figures";
import { useSimulation } from "@/features/calculators/compound-calculator/use-simulation";
import {
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/model/calculator-search";
import {
  addressKeys,
  choices,
} from "@/features/calculators/compound-calculator/address-keys";
import { depositForTarget } from "@/features/calculators/model/compound-math";
import { readMonths, readUnit } from "@/features/calculators/model/duration";
import {
  annualToMonthly,
  monthlyToAnnual,
} from "@/features/calculators/model/rate-math";
import {
  clearFloating,
  floatingKeys,
  readFloating,
} from "@/features/calculators/rate-source/floating";
import {
  useIndexes,
  useIndexRate,
} from "@/features/calculators/rate-source/use-index-rate";

export const maxMonths = 1200;
// A withdrawal lasts years more often than months.
export const withdrawUnits = choices.withdrawUnit;

export type AccumulationInput = ReturnType<typeof useAccumulation>;

export { clearFloating, floatingKeys };

// What the address holds for "final amount" and "deposit for a target": the term, the rate (typed
// or from a daily index), the inflation, the optional delay and withdrawal, and the simulation.
export function useAccumulation() {
  const [search] = useCalculatorSearch(addressKeys);
  const indexes = useIndexes();
  const daily = indexes.filter((i) => i.period === "day");
  const monthly = indexes.filter((i) => i.period === "month");
  const index = daily.find((i) => i.id === search.index);
  const floating = readFloating(
    search,
    floatingKeys,
    index?.id ?? "",
    index?.expected ?? false,
  );
  const monthsUnit = readUnit(search.monthsUnit, choices.monthsUnit);
  const months = readMonths(search.months, monthsUnit, 1, maxMonths);
  const fromIndex = useIndexRate(index, floating, months ?? 12);
  const inflationIndex = monthly.find((i) => i.id === search.inflationIndex);
  const fromInflationIndex = useIndexRate(inflationIndex);

  const target = search.mode === "target";
  const period: "month" | "year" = search.period === "month" ? "month" : "year";
  const typed = readRate(search.rate);
  const annual = annualRate(typed, period, index, floating.value, fromIndex);
  const inflation =
    inflationIndex === undefined
      ? readRate(search.inflation)
      : (fromInflationIndex?.rate ?? null);
  const delayUnit = readUnit(search.delayUnit, choices.delayUnit);
  // No default: a delay exists only once its group is open and holds a value.
  const delay =
    search.delay === undefined
      ? null
      : readMonths(search.delay, delayUnit, 0, maxMonths);
  const initial = readMinor(search.initial) ?? 0;
  const goal = readMinor(search.target);
  const j = annual === null ? null : annualToMonthly(annual);
  const deposit = depositOf(target, goal, initial, j, months, search.deposit);
  const withdrawUnit = readUnit(search.withdrawUnit, choices.withdrawUnit);
  const withdraw = readMonths(search.withdraw, withdrawUnit, 1, maxMonths);
  // Empty by default: no source gives a volatility (design §2, anti-goals).
  const volatility = readRate(search.volatility);
  const range = useSimulation(initial, deposit, months, annual, volatility);
  // The figures of the term; null until the rate, the term and the deposit are known.
  const run =
    j === null || months === null || deposit === null
      ? null
      : {
          j,
          months,
          deposit,
          ...accumulationResult({
            initial,
            deposit,
            j,
            months,
            inflation,
            delay,
          }),
        };

  return {
    target,
    period,
    daily,
    monthly,
    indexes,
    index,
    floating,
    fromIndex,
    inflationIndex,
    fromInflationIndex,
    monthsUnit,
    months,
    annual,
    inflation,
    delayUnit,
    delay,
    initial,
    goal,
    j,
    deposit,
    withdrawUnit,
    withdraw,
    volatility,
    range,
    run,
  };
}

function annualRate(
  typed: number | null,
  period: "month" | "year",
  index: { id: string } | undefined,
  floatingValue: number | null,
  fromIndex: { rate: number } | null,
): number | null {
  if (index !== undefined)
    return floatingValue === null ? null : (fromIndex?.rate ?? null);

  return typed !== null && period === "month" ? monthlyToAnnual(typed) : typed;
}

function depositOf(
  target: boolean,
  goal: number | null,
  initial: number,
  j: number | null,
  months: number | null,
  typed: string | undefined,
): number | null {
  if (j === null || months === null) return null;
  if (!target) return readMinor(typed) ?? 0;

  return goal === null ? null : depositForTarget(goal, initial, j, months);
}
