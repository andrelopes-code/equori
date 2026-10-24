import { IconButton } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { periodLabel } from "@/features/reports/period-label";
import {
  kindOf,
  periodOfKind,
  stepPeriod,
} from "@/features/reports/report-period";
import type {
  PeriodKind,
  ReportPeriod,
} from "@/features/reports/report-period";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/date-input";
import { StepGlyph } from "@/ui/step-glyph";

const kinds: readonly PeriodKind[] = ["month", "quarter", "year", "custom"];

// CP-04: a report reads a calendar month, quarter or year, stepped one at a time, or two days
// of the reader's choice. The period control of the transactions filter has no quarter, and a
// quarter stepped as a run of days drifts off the calendar.
export function ReportPeriodControl({
  value,
  onChange,
}: {
  value: ReportPeriod;
  onChange: (next: ReportPeriod) => void;
}) {
  const t = useT();
  const [tag] = useAppLocale();
  const kind = kindOf(value);
  const [custom, setCustom] = useState(kind === "custom");
  const shown: PeriodKind = custom ? "custom" : kind;
  const label = periodLabel(value, t, tag);
  return (
    <Inline gap={3} wrap="wrap">
      <SegmentedControl
        size="sm"
        aria-label={t("report.period.kind")}
        value={shown}
        onValueChange={(next) => {
          const chosen = kinds.find((k) => k === next);
          if (chosen === undefined) return;
          setCustom(chosen === "custom");
          if (chosen !== "custom") onChange(periodOfKind(chosen, value.from));
        }}
      >
        {kinds.map((k) => (
          <Segment key={k} value={k}>
            {t(`report.period.${k}`)}
          </Segment>
        ))}
      </SegmentedControl>
      {shown === "custom" ? (
        <>
          <Field>
            <FieldLabel>{t("report.period.from")}</FieldLabel>
            <DateInput
              name="from"
              value={value.from}
              shortcuts={false}
              onChange={(from) => {
                onChange({ from, to: value.to });
              }}
            />
          </Field>
          <Field>
            <FieldLabel>{t("report.period.to")}</FieldLabel>
            <DateInput
              name="to"
              value={value.to}
              shortcuts={false}
              onChange={(to) => {
                onChange({ from: value.from, to });
              }}
            />
          </Field>
        </>
      ) : (
        <Inline gap={2}>
          <IconButton
            aria-label={t("report.period.previous")}
            variant="outline"
            tone="secondary"
            onClick={() => {
              onChange(stepPeriod(value, -1));
            }}
          >
            <Icon>
              <StepGlyph direction="previous" />
            </Icon>
          </IconButton>
          <Text weight="medium">{label}</Text>
          <IconButton
            aria-label={t("report.period.next")}
            variant="outline"
            tone="secondary"
            onClick={() => {
              onChange(stepPeriod(value, 1));
            }}
          >
            <Icon>
              <StepGlyph direction="next" />
            </Icon>
          </IconButton>
        </Inline>
      )}
    </Inline>
  );
}
