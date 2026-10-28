import { parseISODate, toISODate } from "@slotted/core/date";
import { Button, IconButton } from "@slotted/react/button";
import { ButtonGroup } from "@slotted/react/button-group";
import { Calendar } from "@slotted/react/calendar";
import type { CalendarValue } from "@slotted/react/calendar";
import { Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverLayer,
  PopoverTitle,
  PopoverTrigger,
} from "@slotted/react/popover";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { periodLabel, periodPresets, stepPeriod } from "@/ui/period-presets";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { StepGlyph } from "@/ui/step-glyph";

export interface Period {
  from: string;
  to: string;
}

// CP-04: a period is read and moved as one thing — the month on screen, a step to its neighbour,
// a preset or a run of days — where the filter bar's date field offers an operator and two inputs.
// The steps move a month by a month, a year by a year and any run by its own length; with no
// period, they open on the current month.
export function PeriodControl({
  value,
  onChange,
  quarters = false,
  allowAll = true,
}: {
  value: Period | undefined;
  onChange: (next: Period | undefined) => void;
  // Offers the quarter holding today and the one before; a quarter then steps as a quarter.
  quarters?: boolean;
  // False for a screen that always reads a period: no "all" choice.
  allowAll?: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarValue>(null);
  const presets = periodPresets(today, quarters);
  const [thisMonth] = presets;

  const step = (direction: -1 | 1) => {
    if (value === undefined) {
      if (thisMonth !== undefined) onChange(thisMonth);
      return;
    }
    onChange(stepPeriod(value.from, value.to, direction));
  };
  const choose = (next: Period | undefined) => {
    setOpen(false);
    onChange(next);
  };
  const current = presets.find(
    (p) => p.from === value?.from && p.to === value.to,
  );
  const label =
    value === undefined
      ? t("transactions.period.all")
      : periodLabel(value.from, value.to, today, locale);
  const range: CalendarValue =
    value === undefined
      ? null
      : { start: parseISODate(value.from), end: parseISODate(value.to) };

  return (
    <ButtonGroup
      aria-label={t("transactions.filter.period")}
      variant="outline"
      tone="secondary"
    >
      <IconButton
        aria-label={t("transactions.period.previous")}
        onClick={() => {
          step(-1);
        }}
      >
        <Icon>
          <StepGlyph direction="previous" />
        </Icon>
      </IconButton>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setDraft(null);
          setOpen(next);
        }}
        size="lg"
        align="end"
      >
        <PopoverTrigger
          render={(props) => (
            // Workaround for Slotted issue #4: the calendar glyph reads below the label, so the
            // trigger shows the label alone.
            <Button {...props}>{label}</Button>
          )}
        />
        <PopoverLayer>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>{t("transactions.period.choose")}</PopoverTitle>
            </PopoverHeader>
            <PopoverBody>
              <Stack gap={4}>
                <Inline gap={2} wrap="wrap">
                  {allowAll && (
                    <Button
                      size="sm"
                      variant={value === undefined ? "solid" : "outline"}
                      tone={value === undefined ? "accent" : "secondary"}
                      aria-pressed={value === undefined}
                      onClick={() => {
                        choose(undefined);
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
                          choose({ from: preset.from, to: preset.to });
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
                  onValueChange={(next) => {
                    setDraft(next);
                    if (
                      next !== null &&
                      "start" in next &&
                      next.start !== null &&
                      next.end !== null
                    ) {
                      choose({
                        from: toISODate(next.start),
                        to: toISODate(next.end),
                      });
                    }
                  }}
                />
              </Stack>
            </PopoverBody>
          </PopoverContent>
        </PopoverLayer>
      </Popover>
      <IconButton
        aria-label={t("transactions.period.next")}
        onClick={() => {
          step(1);
        }}
      >
        <Icon>
          <StepGlyph direction="next" />
        </Icon>
      </IconButton>
    </ButtonGroup>
  );
}
