export type ShellIconName =
  | "overview"
  | "transactions"
  | "cards"
  | "accounts"
  | "goals"
  | "admin"
  | "settings"
  | "plus"
  | "search"
  | "more"
  | "back"
  | "scheme"
  | "language"
  | "logout"
  | "chevrons"
  | "density";

// Lucide geometry (ISC licence) on its 24-unit grid: house, arrow-left-right, credit-card,
// wallet, target, shield, settings, plus, search, layout-grid, arrow-left, moon, globe,
// log-out, chevrons-up-down and rows-3.
const PATHS: Record<ShellIconName, readonly string[]> = {
  overview: [
    "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
    "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  ],
  transactions: ["M8 3 4 7l4 4", "M4 7h16", "m16 21 4-4-4-4", "M20 17H4"],
  cards: [
    "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M2 10h20",
  ],
  accounts: [
    "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
    "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  ],
  goals: [
    "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z",
    "M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12z",
    "M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  ],
  admin: [
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  ],
  settings: [
    "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
    "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  ],
  plus: ["M5 12h14", "M12 5v14"],
  search: ["M11 3a8 8 0 1 1 0 16 8 8 0 0 1 0-16z", "m21 21-4.3-4.3"],
  more: [
    "M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z",
    "M4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z",
  ],
  back: ["m12 19-7-7 7-7", "M19 12H5"],
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
