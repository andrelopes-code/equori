import { Button } from "@slotted/react/button";

import { shiftDate } from "@/i18n/format";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

const shortcuts: { days: number; label: MessageKey }[] = [
  { days: 0, label: "day.today" },
  { days: -1, label: "day.yesterday" },
  { days: -2, label: "day.beforeYesterday" },
];

interface DateShortcutsProps {
  value: string;
  onChoose: (iso: string) => void;
}

// Most entries happened today or a day or two ago. The shortcuts fill the date picker's presets
// column, beside the calendar, so the field itself stays one line.
export function DateShortcuts({ value, onChoose }: DateShortcutsProps) {
  const t = useT();
  const today = useToday();

  return (
    <>
      {shortcuts.map((shortcut) => {
        const iso = shiftDate(today, shortcut.days);
        return (
          <Button
            key={shortcut.days}
            size="sm"
            variant="ghost"
            aria-pressed={iso === value}
            onClick={() => {
              onChoose(iso);
            }}
          >
            {t(shortcut.label)}
          </Button>
        );
      })}
    </>
  );
}
