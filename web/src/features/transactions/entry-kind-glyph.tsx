import type { EntryKind } from "@/features/transactions/entry-kind";

// Lucide 0.460 geometry (ISC licence) on its 24-unit grid: arrow-up-right for money out,
// arrow-down-left for money in, arrow-left-right for a transfer, sliders-horizontal for the
// free form of several postings, trending-up for a trade, circle-dollar-sign strokes for income.
const PATHS: Record<EntryKind, readonly string[]> = {
  expense: ["M7 7h10v10", "M7 17 17 7"],
  income: ["M17 7 7 17", "M17 17H7V7"],
  transfer: ["m8 3-4 4 4 4", "M4 7h16", "m16 21 4-4-4-4", "M20 17H4"],
  trade: ["m3 17 6-6 4 4 8-8", "M14 7h7v7"],
  investment_income: [
    "M12 2v20",
    "M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  ],
  advanced: [
    "M21 4h-7",
    "M10 4H3",
    "M21 12h-9",
    "M8 12H3",
    "M21 20h-5",
    "M12 20H3",
    "M14 2v4",
    "M8 10v4",
    "M16 18v4",
  ],
};

export function EntryKindGlyph({ kind }: { kind: EntryKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
