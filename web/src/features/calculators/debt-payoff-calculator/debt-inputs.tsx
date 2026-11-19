import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";

import { addressKeys } from "@/features/calculators/debt-payoff-calculator/address-keys";
import { DebtRowCard } from "@/features/calculators/debt-payoff-calculator/debt-row-card";
import type { DebtRateQuote } from "@/features/calculators/debt-payoff-calculator/debt-region";
import { maxDebts } from "@/features/calculators/debt-payoff-calculator/debt-rows";
import type { DebtRow } from "@/features/calculators/debt-payoff-calculator/debt-rows";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { ChoiceField } from "@/features/calculators/fields/choice-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { useT } from "@/i18n/i18n-provider";
import type { RatePeriod } from "@/ui/money/rate-input";

interface DebtInputsProps {
  money: CalculatorMoney;
  quote: DebtRateQuote;
  period: RatePeriod;
  rows: readonly DebtRow[];
  owed: ReadonlyMap<string, { name: string }>;
  setRows: (next: readonly DebtRow[]) => void;
}

export function DebtInputs({
  money,
  quote,
  period,
  rows,
  owed,
  setRows,
}: DebtInputsProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  function handleAdd() {
    setRows([
      ...rows,
      { name: "", balance: "", rate: "", minimum: "", account: undefined },
    ]);
  }

  return (
    <>
      <AmountField
        label={t("calc.debt.budget")}
        hint={t("calc.debt.budget.hint")}
        help={[
          `${t("calc.debt.avalanche")}: ${t("calc.debt.avalanche.help")}`,
          `${t("calc.debt.snowball")}: ${t("calc.debt.snowball.help")}`,
        ].join(" ")}
        width="medium"
        value={search.budget}
        money={money}
        onChange={(v) => {
          set({ budget: v });
        }}
      />

      <ChoiceField
        label={t("calc.debt.ratePeriod")}
        {...(period === "year"
          ? {
              hint: t(
                quote.nominal
                  ? "calc.debt.ratePeriod.nominal"
                  : "calc.debt.ratePeriod.effective",
              ),
            }
          : {})}
        choices={[
          { value: "month", label: t("calc.period.month") },
          { value: "year", label: t("calc.period.year") },
        ]}
        value={period}
        onChange={(next) => {
          set({ ratePeriod: next === quote.period ? undefined : next });
        }}
      />

      {rows.map((row, i) => (
        // A row's position is its identity: the rows have no other key.
        <DebtRowCard
          key={i}
          money={money}
          n={i + 1}
          row={row}
          origin={
            row.account === undefined ? undefined : owed.get(row.account)?.name
          }
          onChange={(patch) => {
            setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
          }}
          onRemove={() => {
            setRows(rows.filter((_, j) => j !== i));
          }}
        />
      ))}

      {rows.length < maxDebts && (
        <Inline>
          <Button variant="outline" tone="secondary" onClick={handleAdd}>
            {t("calc.debt.add")}
          </Button>
        </Inline>
      )}
    </>
  );
}
