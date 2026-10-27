import type { SettingsTopic } from "@/features/setup/settings-topics";

// Lucide geometry (ISC licence) on its 24-unit grid: user, palette, globe, eye-off, wallet,
// calendar, plug, sparkles, terminal, database, chevron-right and chevron-left.
const PATHS: Record<SettingsTopic | "next" | "previous", readonly string[]> = {
  account: [
    "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",
    "M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
  ],
  appearance: [
    "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
    "M13.5 6a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z",
    "M17.5 10a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z",
    "M8.5 7a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z",
    "M6.5 12a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z",
  ],
  language: [
    "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z",
    "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",
    "M2 12h20",
  ],
  privacy: [
    "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
    "M14.084 14.158a3 3 0 0 1-4.242-4.242",
    "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
    "m2 2 20 20",
  ],
  finances: [
    "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
    "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  ],
  calendars: [
    "M8 2v4",
    "M16 2v4",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M3 10h18",
  ],
  integrations: [
    "M12 22v-5",
    "M9 8V2",
    "M15 8V2",
    "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z",
  ],
  assistant: [
    "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
    "M20 3v4",
    "M22 5h-4",
  ],
  external_access: ["m4 17 6-6-6-6", "M12 19h8"],
  data: [
    "M12 2c4.97 0 9 1.34 9 3s-4.03 3-9 3-9-1.34-9-3 4.03-3 9-3z",
    "M3 5v14a9 3 0 0 0 18 0V5",
    "M3 12a9 3 0 0 0 18 0",
  ],
  next: ["m9 18 6-6-6-6"],
  previous: ["m15 18-6-6 6-6"],
};

// Families read: icon. The glyph set holds no artwork for these topics, so the page draws its own
// on Lucide's grid, in the stroke of the application's navigation.
export function SettingsIcon({
  name,
}: {
  name: SettingsTopic | "next" | "previous";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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
