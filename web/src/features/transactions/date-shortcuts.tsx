import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";

import { shiftDate } from "@/i18n/format";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

const shortcuts: { days: number; label: MessageKey }[] = [
  { days: 0, label: "day.today" },
  { days: -1, label: "day.yesterday" },
  { days: -2, label: "day.beforeYesterday" },
];

// Most entries happened today or a day or two ago: one press sets those, and the date picker
// beside them stays for any other day.
export function DateShortcuts({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const t = useT();
  const today = useToday();
  return (
    <Inline gap={2} wrap="wrap">
      {shortcuts.map((shortcut) => {
        const iso = shiftDate(today, shortcut.days);
        const on = iso === value;
        return (
          <Button
            key={shortcut.days}
            size="sm"
            variant={on ? "solid" : "outline"}
            tone={on ? "accent" : "secondary"}
            aria-pressed={on}
            onClick={() => {
              onChange(iso);
            }}
          >
            {t(shortcut.label)}
          </Button>
        );
      })}
    </Inline>
  );
}
