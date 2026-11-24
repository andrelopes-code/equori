import { useState } from "react";

// The indexes drawn on the plot: the first daily index at first, then the reader's choice.
export function useChosenSeries(
  indexes: readonly { index: string; period: string }[],
): { on: readonly string[]; toggle: (id: string) => void } {
  const [chosen, setChosen] = useState<readonly string[] | null>(null);

  const on =
    chosen ??
    indexes
      .filter((i) => i.period === "day")
      .slice(0, 1)
      .map((i) => i.index);

  function toggle(id: string) {
    setChosen(on.includes(id) ? on.filter((x) => x !== id) : [...on, id]);
  }

  return { on, toggle };
}
