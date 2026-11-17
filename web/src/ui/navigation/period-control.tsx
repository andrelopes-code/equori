import { Button, IconButton } from "@slotted/react/button";
import { ButtonGroup } from "@slotted/react/button-group";
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
import { useState } from "react";

import { PeriodChoices } from "@/ui/navigation/period-choices";
import { PeriodLabel } from "@/ui/navigation/period-label";
import {
  holdsToday,
  periodLabel,
  periodPresets,
  periodWidest,
  stepPeriod,
} from "@/ui/navigation/period-presets";
import type { PeriodPreset } from "@/ui/navigation/period-presets";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { StepGlyph } from "@/ui/navigation/step-glyph";

export interface Period {
  from: string;
  to: string;
}

// CP-04: a period is read and moved as one thing — the month on screen, a step to its neighbour,
// a preset or a run of days — where the filter bar's date field offers an operator and two inputs.
// The steps move a month by a month, a year by a year and any run by its own length; with no
// period, they open on the current month. The label keeps the width of the widest text a step
// reaches, a mark names the period that holds today and Today returns to its month
// (docs/specs/2026-11-17-period-controls-design.md).
export function PeriodControl({
  value,
  onChange,
  quarters = false,
  allowAll = true,
  extraPresets = [],
}: {
  value: Period | undefined;
  onChange: (next: Period | undefined) => void;
  // Offers the quarter holding today and the one before; a quarter then steps as a quarter.
  quarters?: boolean;
  // False for a screen that always reads a period: no "all" choice.
  allowAll?: boolean;
  // Periods of the screen's own, offered before the common ones.
  extraPresets?: readonly PeriodPreset[];
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarValue>(null);

  const common = periodPresets(today, quarters);
  const presets = [...extraPresets, ...common];
  const [thisMonth] = common;
  const label =
    value === undefined
      ? t("transactions.period.all")
      : periodLabel(value.from, value.to, today, locale);
  const current =
    value !== undefined && holdsToday(value.from, value.to, today);
  const widest =
    value === undefined
      ? []
      : periodWidest(value.from, value.to, today, locale);

  function handleToday() {
    if (thisMonth === undefined) return;

    onChange({ from: thisMonth.from, to: thisMonth.to });
  }

  function step(direction: -1 | 1) {
    if (value === undefined) {
      handleToday();
      return;
    }

    onChange(stepPeriod(value.from, value.to, direction));
  }

  function choose(next: Period | undefined) {
    setOpen(false);
    onChange(next);
  }

  return (
    <Inline gap={4} wrap="nowrap">
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
              <Button
                {...props}
                aria-label={
                  current ? t("period.current", { label }) : undefined
                }
              >
                <PeriodLabel current={current} widest={widest}>
                  {label}
                </PeriodLabel>
              </Button>
            )}
          />
          <PopoverLayer>
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>{t("transactions.period.choose")}</PopoverTitle>
              </PopoverHeader>
              <PopoverBody>
                <PeriodChoices
                  value={value}
                  presets={presets}
                  allowAll={allowAll}
                  draft={draft}
                  onDraftChange={setDraft}
                  onChoose={choose}
                />
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

      <Button
        variant="ghost"
        tone="secondary"
        disabled={current}
        onClick={handleToday}
      >
        {t("period.today")}
      </Button>
    </Inline>
  );
}
