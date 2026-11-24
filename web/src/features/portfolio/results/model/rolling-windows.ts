import type { MonthReturn } from "@/features/portfolio/results/model/month-returns";

export interface Window {
  end: string;
  value: number;
}

const defaultSize = 12;

// A window is the product of `size` consecutive month factors, minus 1 (PR7).
export function rollingWindows(
  months: readonly MonthReturn[],
  size = defaultSize,
): Window[] {
  const windows: Window[] = [];

  for (let end = size - 1; end < months.length; end++) {
    const factor = months
      .slice(end - size + 1, end + 1)
      .reduce((product, m) => product * (1 + m.value), 1);

    windows.push({ end: months[end]?.month ?? "", value: factor - 1 });
  }

  return windows;
}

// The share of the windows strictly above a number or above the window of the same end.
export function shareAbove(
  windows: readonly Window[],
  reference: readonly Window[] | number,
): number {
  if (windows.length === 0) return 0;

  const above = windows.filter((w) => {
    if (typeof reference === "number") return w.value > reference;

    const other = reference.find((r) => r.end === w.end);

    return other !== undefined && w.value > other.value;
  });

  return above.length / windows.length;
}
