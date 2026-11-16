import { Stack } from "@slotted/react/stack";

import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import { CompoundModeField } from "@/features/calculators/compound-calculator/compound-mode-field";
import { sources } from "@/features/calculators/compound-calculator/compound-sources";
import { IncomeDetails } from "@/features/calculators/compound-calculator/income-details";
import { IncomeResults } from "@/features/calculators/compound-calculator/income-results";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { DurationField } from "@/features/calculators/fields/duration-field";
import { RateField } from "@/features/calculators/fields/rate-field";
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
import {
  readMonths,
  readUnit,
  unitPatch,
} from "@/features/calculators/model/duration";
import type { DurationUnit } from "@/features/calculators/model/duration";
import { annualToMonthly } from "@/features/calculators/model/rate-math";
import { useT } from "@/i18n/i18n-provider";

const maxMonths = 1200;
// A life on the income lasts years more often than months.
const termUnits: readonly DurationUnit[] = ["year", "month"];

// Design §5, compound, mode "live on income": the balance earns each month, a share of the income
// is reinvested and the rest is spent, month by month and year by year.
export function IncomeCalculator() {
  const t = useT();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();

  const unit = readUnit(search.monthsUnit, termUnits);
  const months = readMonths(search.months, unit, 1, maxMonths);
  const period = search.period === "month" ? "month" : "year";
  const typed = readRate(search.rate);
  const j =
    typed === null ? null : period === "month" ? typed : annualToMonthly(typed);
  const balance = readMinor(search.initial);
  const share =
    search.share === undefined ? REINVESTED_SHARE : readShare(search.share);

  if (money === null)
    return (
      <CalculatorFrame
        id="compound"
        inputs={null}
        results={null}
        method={null}
      />
    );

  const rows =
    balance === null ||
    balance === 0 ||
    j === null ||
    j <= 0 ||
    months === null ||
    share === null
      ? null
      : incomeEvolution(balance, j, share, months);

  return (
    <CalculatorFrame
      id="compound"
      inputs={
        <>
          <CompoundModeField />

          <AmountField
            label={t("calc.compound.live.balance")}
            hint={t("calc.compound.live.balance.hint")}
            value={search.initial}
            money={money}
            onChange={(v) => {
              set({ initial: v });
            }}
          />

          <RateField
            label={t("calc.compound.rate")}
            hint={t("calc.compound.rate.hint")}
            name="rate"
            value={search.rate ?? ""}
            onChange={(v) => {
              set({ rate: v });
            }}
            period={period}
            onPeriodChange={(p) => {
              set({ period: p === "month" ? "month" : undefined });
            }}
          />

          <RateField
            label={t("calc.compound.live.share")}
            hint={t("calc.compound.live.share.hint")}
            name="share"
            value={search.share ?? ""}
            onChange={(v) => {
              set({ share: v });
            }}
          />

          <DurationField
            label={t("calc.compound.live.term")}
            hint={t("calc.compound.live.term.hint")}
            name="months"
            value={search.months ?? ""}
            onChange={(v) => {
              set({ months: v });
            }}
            unit={unit}
            units={termUnits}
            onUnitChange={(u) => {
              set(unitPatch("months", search.months, unit, u, termUnits));
            }}
          />
        </>
      }
      results={
        rows === null || share === null ? null : (
          <Stack gap={6}>
            <IncomeResults rows={rows} money={money} share={share} />
          </Stack>
        )
      }
      details={
        rows === null ? null : <IncomeDetails rows={rows} money={money} />
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
