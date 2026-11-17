import { parseISODate, toISODate } from "@slotted/core/date";
import { Button } from "@slotted/react/button";
import { Calendar } from "@slotted/react/calendar";
import type { CalendarValue } from "@slotted/react/calendar";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";
import type { Period } from "@/ui/navigation/period-control";
import type { PeriodPreset } from "@/ui/navigation/period-presets";

interface PeriodChoicesProps {
  value: Period | undefined;
  presets: readonly PeriodPreset[];
  // False for a screen that always reads a period: no "all" choice.
  allowAll: boolean;
  // The run of days being picked, before its last day.
  draft: CalendarValue;
  onDraftChange: (next: CalendarValue) => void;
  onChoose: (next: Period | undefined) => void;
}

// The choices of the period popover: "all", the presets and a run of days on the calendar.
export function PeriodChoices({
  value,
  presets,
  allowAll,
  draft,
  onDraftChange,
  onChoose,
}: PeriodChoicesProps) {
  const t = useT();

  const current = presets.find(
    (p) => p.from === value?.from && p.to === value.to,
  );
  const range: CalendarValue =
    value === undefined
      ? null
      : { start: parseISODate(value.from), end: parseISODate(value.to) };

  function handleRange(next: CalendarValue) {
    onDraftChange(next);
    if (
      next !== null &&
      "start" in next &&
      next.start !== null &&
      next.end !== null
    ) {
      onChoose({ from: toISODate(next.start), to: toISODate(next.end) });
    }
  }

  return (
    <Stack gap={4}>
      <Inline gap={2} wrap="wrap">
        {allowAll && (
          <Button
            size="sm"
            variant={value === undefined ? "solid" : "outline"}
            tone={value === undefined ? "accent" : "secondary"}
            aria-pressed={value === undefined}
            onClick={() => {
              onChoose(undefined);
            }}
          >
            {t("transactions.period.all")}
          </Button>
        )}
        {presets.map((preset) => {
          const on = preset.key === current?.key;
          return (
            <Button
              key={preset.key}
              size="sm"
              variant={on ? "solid" : "outline"}
              tone={on ? "accent" : "secondary"}
              aria-pressed={on}
              onClick={() => {
                onChoose({ from: preset.from, to: preset.to });
              }}
            >
              {t(preset.label)}
            </Button>
          );
        })}
      </Inline>

      <Text size="sm" tone="muted">
        {t("transactions.period.custom")}
      </Text>

      <Calendar
        selectionMode="range"
        value={draft ?? range}
        onValueChange={handleRange}
      />
    </Stack>
  );
}
