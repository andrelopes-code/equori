import type { MonthReturn } from "@/features/portfolio/results/model/month-returns";

export interface Window {
  end: string;
  value: number;
}

export interface Share {
  count: number;
  // The windows the count is taken from.
  total: number;
  // A fraction from 0 to 1.
  share: number;
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

// The windows strictly above a number, or above the window of the same end; a window whose end the
// reference lacks leaves the total (PR7).
export function shareAbove(
  windows: readonly Window[],
  reference: readonly Window[] | number,
): Share {
  const compared = windows.flatMap((w) => {
    const other =
      typeof reference === "number"
        ? reference
        : reference.find((r) => r.end === w.end)?.value;

    return other === undefined ? [] : [w.value > other];
  });
  const count = compared.filter(Boolean).length;

  return shareOf(count, compared.length);
}

export function shareOf(count: number, total: number): Share {
  return { count, total, share: total === 0 ? 0 : count / total };
}
