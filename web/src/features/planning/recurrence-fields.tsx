import { Field, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupDescription,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { NumberField } from "@slotted/react/number-field";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import {
  recurrenceWords,
  weekdayName,
  weekdays,
} from "@/features/planning/schedule-words";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormRow } from "@/ui/form-row";

type Recurrence = components["schemas"]["Recurrence"];
type Mode = "day" | "weekday" | "business";
type End = "never" | "until" | "count";

const frequencies: readonly Recurrence["frequency"][] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];
const adjustments: readonly Recurrence["adjustment"][] = [
  "none",
  "following",
  "preceding",
  "modified_following",
];
const last = "-1";

function modeOf(r: Recurrence): Mode {
  if (r.business_day_ordinal !== undefined) return "business";
  if (r.weekday !== undefined) return "weekday";
  return "day";
}

function endOf(r: Recurrence): End {
  if (r.until !== undefined) return "until";
  if (r.count !== undefined) return "count";
  return "never";
}

// The fields of a monthly rule that the chosen mode keeps; the server takes exactly one of them.
function withoutDay(r: Recurrence): Recurrence {
  const next = { ...r };
  delete next.day_of_month;
  delete next.weekday;
  delete next.ordinal;
  delete next.business_day_ordinal;
  return next;
}

function withoutEnd(r: Recurrence): Recurrence {
  const next = { ...r };
  delete next.until;
  delete next.count;
  return next;
}

function numbers(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

// CP-04: the recurrence builder; no family states a rule of dates, and the rule is read back in
// words under the fields before anything is saved.
export function RecurrenceFields({
  value,
  onChange,
  fill = false,
}: {
  value: Recurrence;
  onChange: (next: Recurrence) => void;
  // In a dialog every control fills its column (docs/contributing/forms.md, F15).
  fill?: boolean;
}) {
  const t = useT();
  const medium = fill ? undefined : widths.medium;
  const short = fill ? undefined : widths.short;
  const date = fill ? widths.fill : undefined;
  const [locale] = useAppLocale();
  const mode = modeOf(value);
  const end = endOf(value);
  const field = (label: string, control: ReactNode) => (
    <Field required className={medium}>
      <FieldLabel>{label}</FieldLabel>
      {control}
    </Field>
  );
  const day = (key: "day_of_month" | "business_day_ordinal", max: number) => {
    const label = t(
      key === "day_of_month" ? "recurrence.day" : "recurrence.businessDay",
    );
    return field(
      label,
      <ChoiceSelect
        label={label}
        multiple={false}
        value={String(value[key] ?? 1)}
        choices={[
          ...numbers(1, max).map((n) => ({ value: n, label: n })),
          {
            value: last,
            label: t(
              key === "day_of_month"
                ? "recurrence.lastDay"
                : "recurrence.lastBusinessDay",
            ),
          },
        ]}
        onChange={(next) => {
          if (typeof next === "string")
            onChange({ ...withoutDay(value), [key]: Number(next) });
        }}
      />,
    );
  };
  const weekdayChoice = field(
    t("recurrence.weekday"),
    <ChoiceSelect
      label={t("recurrence.weekday")}
      multiple={false}
      value={value.weekday ?? null}
      choices={weekdays.map((w) => ({
        value: w,
        label: weekdayName(w, locale),
      }))}
      onChange={(next) => {
        const weekday = weekdays.find((w) => w === next);
        if (weekday !== undefined) onChange({ ...value, weekday });
      }}
    />,
  );
  return (
    <Stack gap={8}>
      <FormRow>
        <Field required className={medium}>
          <FieldLabel>{t("recurrence.frequency")}</FieldLabel>
          <ChoiceSelect
            label={t("recurrence.frequency")}
            multiple={false}
            value={value.frequency}
            choices={frequencies.map((f) => ({
              value: f,
              label: t(`recurrence.frequency.${f}`),
            }))}
            onChange={(next) => {
              const frequency = frequencies.find((f) => f === next);
              if (frequency === undefined) return;
              const base = withoutDay({ ...value, frequency });
              const start = Number(value.start.slice(8, 10));
              onChange(
                frequency === "monthly"
                  ? { ...base, day_of_month: start }
                  : frequency === "weekly"
                    ? { ...base, weekday: "monday" }
                    : base,
              );
            }}
          />
        </Field>

        <Field required className={short}>
          <FieldLabel>{t("recurrence.interval")}</FieldLabel>
          <NumberField
            name="interval"
            value={value.interval}
            min={1}
            max={120}
            onValueChange={(next) => {
              if (next !== null) onChange({ ...value, interval: next });
            }}
          />
        </Field>
      </FormRow>

      {value.frequency === "monthly" && (
        <FieldGroup required>
          <FieldGroupLegend>{t("recurrence.mode")}</FieldGroupLegend>
          <FieldGroupContent>
            <Inline>
              <SegmentedControl
                aria-label={t("recurrence.mode")}
                value={mode}
                onValueChange={(next) => {
                  const base = withoutDay(value);
                  if (next === "day") onChange({ ...base, day_of_month: 1 });
                  if (next === "weekday")
                    onChange({ ...base, weekday: "monday", ordinal: 1 });
                  if (next === "business")
                    onChange({ ...base, business_day_ordinal: 1 });
                }}
              >
                <Segment value="day">{t("recurrence.mode.day")}</Segment>
                <Segment value="weekday">
                  {t("recurrence.mode.weekday")}
                </Segment>
                <Segment value="business">
                  {t("recurrence.mode.business")}
                </Segment>
              </SegmentedControl>
            </Inline>
          </FieldGroupContent>
        </FieldGroup>
      )}

      {value.frequency === "monthly" &&
        mode === "day" &&
        day("day_of_month", 31)}
      {value.frequency === "monthly" &&
        mode === "business" &&
        day("business_day_ordinal", 23)}
      {value.frequency === "monthly" && mode === "weekday" && (
        <FormRow>
          {field(
            t("recurrence.ordinal"),
            <ChoiceSelect
              label={t("recurrence.ordinal")}
              multiple={false}
              value={String(value.ordinal ?? 1)}
              choices={["1", "2", "3", "4", "5", last].map((n) => ({
                value: n,
                label: t(
                  n === last
                    ? "recurrence.ordinal.last"
                    : `recurrence.ordinal.${n as "1"}`,
                ),
              }))}
              onChange={(next) => {
                if (typeof next === "string")
                  onChange({ ...value, ordinal: Number(next) });
              }}
            />,
          )}
          {weekdayChoice}
        </FormRow>
      )}
      {value.frequency === "weekly" && weekdayChoice}

      <Field required>
        <FieldLabel>{t("recurrence.adjustment")}</FieldLabel>
        <ChoiceSelect
          label={t("recurrence.adjustment")}
          multiple={false}
          value={value.adjustment}
          choices={adjustments.map((a) => ({
            value: a,
            label: t(`recurrence.adjustment.${a}`),
          }))}
          onChange={(next) => {
            const adjustment = adjustments.find((a) => a === next);
            if (adjustment !== undefined) onChange({ ...value, adjustment });
          }}
        />
      </Field>

      <Field required>
        <FieldLabel>{t("recurrence.start")}</FieldLabel>
        <DateInput
          name="start"
          className={date}
          value={value.start}
          shortcuts={false}
          onChange={(start) => {
            onChange({ ...value, start });
          }}
        />
      </Field>

      <FieldGroup required>
        <FieldGroupLegend>{t("recurrence.end")}</FieldGroupLegend>
        <FieldGroupContent>
          <Inline>
            <SegmentedControl
              aria-label={t("recurrence.end")}
              value={end}
              onValueChange={(next) => {
                const base = withoutEnd(value);
                if (next === "never") onChange(base);
                if (next === "until") onChange({ ...base, until: value.start });
                if (next === "count") onChange({ ...base, count: 12 });
              }}
            >
              <Segment value="never">{t("recurrence.end.never")}</Segment>
              <Segment value="until">{t("recurrence.end.until")}</Segment>
              <Segment value="count">{t("recurrence.end.count")}</Segment>
            </SegmentedControl>
          </Inline>
        </FieldGroupContent>
        <FieldGroupDescription>
          {recurrenceWords(value, t, locale)}
        </FieldGroupDescription>
      </FieldGroup>

      {value.until !== undefined && (
        <Field required>
          <FieldLabel>{t("recurrence.untilField")}</FieldLabel>
          <DateInput
            name="until"
            className={date}
            value={value.until}
            min={value.start}
            shortcuts={false}
            onChange={(until) => {
              onChange({ ...value, until });
            }}
          />
        </Field>
      )}

      {value.count !== undefined && (
        <Field required className={short}>
          <FieldLabel>{t("recurrence.countField")}</FieldLabel>
          <NumberField
            name="count"
            value={value.count}
            min={1}
            max={10000}
            onValueChange={(next) => {
              if (next !== null) onChange({ ...value, count: next });
            }}
          />
        </Field>
      )}
    </Stack>
  );
}
