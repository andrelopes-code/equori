import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { NumberField } from "@slotted/react/number-field";

import { useT } from "@/i18n/i18n-provider";
import widths from "@/ui/field-width.module.css";

export interface MatchingValues {
  toleranceBP: number;
  windowDays: number;
  graceDays: number;
}

interface MatchingFieldsProps {
  values: MatchingValues;
  patch: (change: Partial<MatchingValues>) => void;
}

// The match tolerance, the date window and the grace days, in basis points and days.
export function MatchingFields({ values, patch }: MatchingFieldsProps) {
  const t = useT();

  return (
    <>
      <Field required>
        <FieldLabel>{t("schedule.tolerance")}</FieldLabel>
        <NumberField
          className={widths.short}
          name="match_tolerance"
          value={values.toleranceBP / 100}
          min={0}
          max={100}
          step={0.01}
          onValueChange={(next) => {
            if (next !== null) patch({ toleranceBP: Math.round(next * 100) });
          }}
        />
        <FieldDescription>{t("schedule.toleranceHint")}</FieldDescription>
      </Field>

      <Field required>
        <FieldLabel>{t("schedule.window")}</FieldLabel>
        <NumberField
          className={widths.short}
          name="match_window_days"
          value={values.windowDays}
          min={0}
          max={31}
          onValueChange={(next) => {
            if (next !== null) patch({ windowDays: next });
          }}
        />
        <FieldDescription>{t("schedule.windowHint")}</FieldDescription>
      </Field>

      <Field required>
        <FieldLabel>{t("schedule.grace")}</FieldLabel>
        <NumberField
          className={widths.short}
          name="grace_days"
          value={values.graceDays}
          min={0}
          max={31}
          onValueChange={(next) => {
            if (next !== null) patch({ graceDays: next });
          }}
        />
        <FieldDescription>{t("schedule.graceHint")}</FieldDescription>
      </Field>
    </>
  );
}
