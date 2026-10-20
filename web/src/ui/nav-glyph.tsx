import { useId } from "react";

// Each glyph is a shape and the details drawn on it. Outline strokes both; filled paints the
// shape and cuts the details out of it, so a selected tab reads by its mass (shell third
// pass N2).
export type NavGlyphName = "home" | "list" | "card" | "more" | "plus";

const GLYPHS: Record<
  NavGlyphName,
  { shape: string | null; details: readonly string[]; weight?: number }
> = {
  home: {
    shape: "M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
    details: ["M10 20v-4.5a2 2 0 0 1 4 0V20"],
  },
  list: {
    shape:
      "M6 3.5h12A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5z",
    details: ["M8 8.5h8", "M8 12h8", "M8 15.5h4.5"],
  },
  card: {
    shape:
      "M5 5.5h14A2.5 2.5 0 0 1 21.5 8v8a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 16V8A2.5 2.5 0 0 1 5 5.5z",
    details: ["M2.5 10h19", "M6.5 14.5h3"],
  },
  more: {
    shape: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z",
    details: ["M8 12h.01", "M12 12h.01", "M16 12h.01"],
    // A dot is a round cap on a zero-length stroke; at the shape's weight it reads as a speck.
    weight: 2.5,
  },
  plus: { shape: null, details: ["M12 6v12", "M6 12h12"] },
};

export function NavGlyph({
  name,
  filled = false,
}: {
  name: NavGlyphName;
  filled?: boolean;
}) {
  const mask = useId();
  const { shape, details, weight } = GLYPHS[name];
  const cut = filled && shape !== null;
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-variant={filled ? "filled" : "outline"}
    >
      {cut ? (
        <>
          <mask id={mask}>
            <rect width="24" height="24" fill="white" />
            {details.map((d) => (
              <path key={d} d={d} stroke="black" strokeWidth={weight ?? 2} />
            ))}
          </mask>
          <path d={shape} fill="currentColor" mask={`url(#${mask})`} />
        </>
      ) : (
        <>
          {shape !== null && <path d={shape} />}
          {details.map((d) => (
            <path key={d} d={d} strokeWidth={weight} />
          ))}
        </>
      )}
    </svg>
  );
}
