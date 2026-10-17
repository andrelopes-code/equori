// The Slotted Glyph set has plus and ellipsis only; the other navigation glyphs are path data here.
const GLYPHS = {
  home: ["M3 11l9-8 9 8", "M5 10v10h14V10"],
  list: ["M8 6h13M8 12h13M8 18h13", "M3 6h.01M3 12h.01M3 18h.01"],
  plus: ["M12 5v14M5 12h14"],
  wallet: [
    "M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
    "M3 7l12-4v4",
    "M17 14h.01",
  ],
  more: ["M5 12h.01M12 12h.01M19 12h.01"],
  transfer: ["M4 8h16M16 4l4 4-4 4", "M20 16H4M8 12l-4 4 4 4"],
} as const;

export type IconGlyphName = keyof typeof GLYPHS;

export function IconGlyph({ name }: { name: IconGlyphName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
