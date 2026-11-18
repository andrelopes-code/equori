export type HelpIconName = "search" | "open" | "expand" | "play";

// Lucide geometry (ISC licence) on its 24-unit grid: search, arrow-up-right, maximize-2, play.
const PATHS: Record<HelpIconName, readonly string[]> = {
  search: ["m21 21-4.34-4.34", "M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0"],
  open: ["M7 7h10v10", "M7 17 17 7"],
  expand: ["M15 3h6v6", "m21 3-7 7", "M9 21H3v-6", "m3 21 7-7"],
  play: ["M6 4v16l14-8z"],
};

interface HelpIconProps {
  name: HelpIconName;
}

// Families read: icon.
// Workaround for Slotted issue #141: the glyph set holds no magnifier, enlarge, play or
// open-elsewhere mark, so the help draws them on Lucide's grid like the shell's own marks.
export function HelpIcon({ name }: HelpIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
