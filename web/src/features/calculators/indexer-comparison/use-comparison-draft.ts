import { useRef, useState } from "react";

import { addYears } from "@/features/calculators/indexer-comparison/comparison-dates";
import type { DraftSecurity } from "@/features/calculators/indexer-comparison/security-draft";

const maxSecurities = 6;

// The inputs of the comparison (IC1): the amount, the maturity two years out, the tax rate typed
// in a region without rules, and the securities: a fixed one, then the default row.
export function useComparisonDraft(initialAmount: number, today: string) {
  const [amount, setAmount] = useState(initialAmount);
  const [maturity, setMaturity] = useState(() => addYears(today, 2));
  const [taxRate, setTaxRate] = useState("");
  const [rows, setRows] = useState<DraftSecurity[]>([
    { key: 1, choice: "fixed", rate: "", taxed: true },
    { key: 2, choice: null, rate: "", taxed: true },
  ]);
  const nextKey = useRef(3);

  function add() {
    setRows((current) =>
      current.length >= maxSecurities
        ? current
        : [
            ...current,
            { key: nextKey.current++, choice: null, rate: "", taxed: true },
          ],
    );
  }

  function remove(key: number) {
    setRows((current) => current.filter((r) => r.key !== key));
  }

  function change(key: number, patch: Partial<Omit<DraftSecurity, "key">>) {
    setRows((current) =>
      current.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  return {
    amount,
    setAmount,
    maturity,
    setMaturity,
    taxRate,
    setTaxRate,
    rows,
    canAdd: rows.length < maxSecurities,
    add,
    remove,
    change,
  };
}
