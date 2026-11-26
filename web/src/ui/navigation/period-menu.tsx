import { Button } from "@slotted/react/button";
import type { CalendarValue } from "@slotted/react/calendar";
import { Glyph, Icon } from "@slotted/react/icon";
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

import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import type { Period } from "@/ui/navigation/period-control";
import { PeriodChoices } from "@/ui/navigation/period-choices";
import { periodLabel, periodPresets } from "@/ui/navigation/period-presets";

interface PeriodMenuProps {
  value: Period | undefined;
  onChange: (next: Period | undefined) => void;
}

// The period of a phone screen: one button that names the period and opens the choices of the
// period control, without the steps that would take the row (spec 2026-11-21-mobile-statement,
// MS11).
export function PeriodMenu({ value, onChange }: PeriodMenuProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarValue>(null);

  const label =
    value === undefined
      ? t("transactions.period.all")
      : periodLabel(value.from, value.to, today, locale);

  function handleOpenChange(next: boolean) {
    setDraft(null);
    setOpen(next);
  }

  function handleChoose(next: Period | undefined) {
    setOpen(false);
    onChange(next);
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      align="start"
      presentation="auto"
    >
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            tone="secondary"
            end={
              <Icon size="sm">
                <Glyph name="chevron-down" />
              </Icon>
            }
          >
            {label}
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
              presets={periodPresets(today, false)}
              allowAll
              draft={draft}
              onDraftChange={setDraft}
              onChoose={handleChoose}
            />
          </PopoverBody>
        </PopoverContent>
      </PopoverLayer>
    </Popover>
  );
}
