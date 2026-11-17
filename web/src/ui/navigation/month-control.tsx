import { parseISODate, toISOYearMonth } from "@slotted/core/date";
import { Button, IconButton } from "@slotted/react/button";
import { ButtonGroup } from "@slotted/react/button-group";
import { Calendar } from "@slotted/react/calendar";
import { Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverLayer,
  PopoverTrigger,
} from "@slotted/react/popover";
import { useState } from "react";

import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { PeriodLabel } from "@/ui/navigation/period-label";
import { monthTitles } from "@/ui/navigation/period-presets";
import { StepGlyph } from "@/ui/navigation/step-glyph";

function shiftMonth(month: string, by: number): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + by;
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, "0")}`;
}

interface MonthControlProps {
  // YYYY-MM.
  value: string;
  // The last month the control reaches, YYYY-MM; the next step stops there.
  max?: string;
  onChange: (month: string) => void;
  // The group's name: what the month bounds.
  label: string;
}

// CP-04: a month is read as its name and moved a step at a time; the month field of the
// date-picker family shows "10 / 2026" and moves only through its calendar. The label keeps the
// width of the widest month of its year, a mark names the month of today and Today returns to it
// (docs/specs/2026-11-17-period-controls-design.md).
export function MonthControl({
  value,
  max,
  onChange,
  label,
}: MonthControlProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();

  const [open, setOpen] = useState(false);

  const last = max === undefined ? null : parseISODate(`${max}-01`);
  const thisMonth = today.slice(0, 7);
  const current = value === thisMonth;
  const reachesToday = max === undefined || thisMonth <= max;
  const title = formatMonthTitle(value, locale);

  return (
    <Inline gap={4} wrap="nowrap">
      <ButtonGroup aria-label={label} variant="outline" tone="secondary">
        <IconButton
          aria-label={t("month.previous")}
          onClick={() => {
            onChange(shiftMonth(value, -1));
          }}
        >
          <Icon>
            <StepGlyph direction="previous" />
          </Icon>
        </IconButton>
        <Popover open={open} onOpenChange={setOpen} align="center">
          <PopoverTrigger
            render={(props) => (
              <Button
                {...props}
                aria-label={
                  current ? t("period.current", { label: title }) : undefined
                }
              >
                <PeriodLabel
                  current={current}
                  widest={monthTitles(value.slice(0, 4), locale)}
                >
                  {title}
                </PeriodLabel>
              </Button>
            )}
          />
          <PopoverLayer>
            <PopoverContent aria-label={label}>
              <PopoverBody>
                <Calendar
                  granularity="month"
                  // A month cell's value is the first day of that month.
                  value={parseISODate(`${value}-01`)}
                  max={last ?? undefined}
                  onValueChange={(next) => {
                    if (
                      next !== null &&
                      !Array.isArray(next) &&
                      "year" in next
                    ) {
                      setOpen(false);
                      onChange(toISOYearMonth(next));
                    }
                  }}
                />
              </PopoverBody>
            </PopoverContent>
          </PopoverLayer>
        </Popover>
        <IconButton
          aria-label={t("month.next")}
          disabled={max !== undefined && value >= max}
          onClick={() => {
            onChange(shiftMonth(value, 1));
          }}
        >
          <Icon>
            <StepGlyph direction="next" />
          </Icon>
        </IconButton>
      </ButtonGroup>

      {reachesToday && (
        <Button
          variant="ghost"
          tone="secondary"
          disabled={current}
          onClick={() => {
            onChange(thisMonth);
          }}
        >
          {t("period.today")}
        </Button>
      )}
    </Inline>
  );
}
