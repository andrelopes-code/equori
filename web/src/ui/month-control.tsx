import { parseISODate, toISOYearMonth } from "@slotted/core/date";
import { Button, IconButton } from "@slotted/react/button";
import { ButtonGroup } from "@slotted/react/button-group";
import { Calendar } from "@slotted/react/calendar";
import { Icon } from "@slotted/react/icon";
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
import { StepGlyph } from "@/ui/step-glyph";

function shiftMonth(month: string, by: number): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + by;
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// CP-04: a month is read as its name and moved a step at a time; the month field of the
// date-picker family shows "10 / 2026" and moves only through its calendar.
export function MonthControl({
  value,
  onChange,
  label,
}: {
  // YYYY-MM.
  value: string;
  onChange: (month: string) => void;
  // The group's name: what the month bounds.
  label: string;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const [open, setOpen] = useState(false);
  return (
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
            <Button {...props}>{formatMonthTitle(value, locale)}</Button>
          )}
        />
        <PopoverLayer>
          <PopoverContent aria-label={label}>
            <PopoverBody>
              <Calendar
                granularity="month"
                // A month cell's value is the first day of that month.
                value={parseISODate(`${value}-01`)}
                onValueChange={(next) => {
                  if (next !== null && !Array.isArray(next) && "year" in next) {
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
        onClick={() => {
          onChange(shiftMonth(value, 1));
        }}
      >
        <Icon>
          <StepGlyph direction="next" />
        </Icon>
      </IconButton>
    </ButtonGroup>
  );
}
