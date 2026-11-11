import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { NumberField } from "@slotted/react/number-field";

import { useT } from "@/i18n/i18n-provider";

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
      <Field width="short" required>
        <FieldLabel>{t("schedule.tolerance")}</FieldLabel>
        <NumberField
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

      <Field width="short" required>
        <FieldLabel>{t("schedule.window")}</FieldLabel>
        <NumberField
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

      <Field width="short" required>
        <FieldLabel>{t("schedule.grace")}</FieldLabel>
        <NumberField
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
