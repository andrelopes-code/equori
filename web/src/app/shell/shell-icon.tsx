export type ShellIconName =
  | "overview"
  | "transactions"
  | "categories"
  | "cards"
  | "accounts"
  | "goals"
  | "planning"
  | "instruments"
  | "reports"
  | "calculator"
  | "settings"
  | "plus"
  | "form"
  | "text"
  | "search"
  | "assistant"
  | "more"
  | "back"
  | "scheme"
  | "language"
  | "logout"
  | "chevrons"
  | "density"
  | "eye"
  | "eye-off";

// Lucide geometry (ISC licence) on its 24-unit grid: house, arrow-left-right, tags, credit-card,
// wallet, target, calendar, shield, calculator, settings, plus, square-pen, text, search, layout-grid, arrow-left,
// moon, globe, log-out, chevrons-up-down, rows-3, eye and eye-off.
const PATHS: Record<ShellIconName, readonly string[]> = {
  assistant: [
    "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
    "M20 3v4",
    "M22 5h-4",
    "M4 17v2",
    "M5 18H3",
  ],
  overview: [
    "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
    "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  ],
  transactions: ["M8 3 4 7l4 4", "M4 7h16", "m16 21 4-4-4-4", "M20 17H4"],
  categories: [
    "m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19",
    "M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z",
    "M6 9.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0",
  ],
  cards: [
    "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M2 10h20",
  ],
  accounts: [
    "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
    "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  ],
  calculator: [
    "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
    "M8 6h8",
    "M16 14v4",
    "M16 10h.01",
    "M12 10h.01",
    "M8 10h.01",
    "M12 14h.01",
    "M8 14h.01",
    "M12 18h.01",
    "M8 18h.01",
  ],
  goals: [
    "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z",
    "M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12z",
    "M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  ],
  planning: [
    "M8 2v4",
    "M16 2v4",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M3 10h18",
  ],
  instruments: ["M16 7h6v6", "m22 7-8.5 8.5-5-5L2 17"],
  reports: ["M3 3v16a2 2 0 0 0 2 2h16", "M18 17V9", "M13 17V5", "M8 17v-3"],
  settings: [
    "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
    "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  ],
  plus: ["M5 12h14", "M12 5v14"],
  form: [
    "M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
    "M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",
  ],
  text: ["M15 18H3", "M17 6H3", "M21 12H3"],
  search: ["M11 3a8 8 0 1 1 0 16 8 8 0 0 1 0-16z", "m21 21-4.3-4.3"],
  more: [
    "M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z",
    "M4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z",
  ],
  back: ["m12 19-7-7 7-7", "M19 12H5"],
  eye: [
    "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ],
  "eye-off": [
    "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
    "M14.084 14.158a3 3 0 0 1-4.242-4.242",
    "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
    "m2 2 20 20",
  ],
  scheme: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"],
  language: [
    "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z",
    "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",
    "M2 12h20",
  ],
  logout: [
    "m16 17 5-5-5-5",
    "M21 12H9",
    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
  ],
  chevrons: ["m7 15 5 5 5-5", "m7 9 5-5 5 5"],
  density: [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M21 9H3",
    "M21 15H3",
  ],
};

// Families read: icon. The glyph set holds no destination artwork, so the shell draws its
// own on Lucide's grid. One stroke family for every mark; a selected destination reads by
// its weight, its colour and the ground behind it, never by a second drawing.
export function ShellIcon({
  name,
  size,
  weight = 1.75,
}: {
  name: ShellIconName;
  // Pixels; absent, the mark fills the box a family's icon part gives it.
  size?: number;
  weight?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size ?? "100%"}
      height={size ?? "100%"}
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
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
