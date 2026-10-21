// Workaround for Slotted finding "The glyph set has no chevron-left or arrow-right": Lucide's
// chevrons (ISC licence), drawn like the library's own glyphs inside an Icon.
export function StepGlyph({ direction }: { direction: "previous" | "next" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={direction === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}
