import { Checkbox } from "@slotted/react/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { calendarLabel, calendarsQuery } from "@/features/planning";
import type { TermsDraft } from "@/features/instruments/terms/terms-draft";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { DateInput } from "@/ui/form-fields/date-input";

interface TermsLiquidityFieldsProps {
  draft: TermsDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<TermsDraft>) => void;
}

export function TermsLiquidityFields({
  draft,
  errors,
  onChange,
}: TermsLiquidityFieldsProps) {
  const t = useT();
  const api = useApi();
  const calendars = useQuery(calendarsQuery(api)).data?.items ?? [];
  const choices = [
    { value: "", label: t("terms.calendarNone") },
    ...calendars.map((c) => ({ value: c.id, label: calendarLabel(t, c.id) })),
  ];

  return (
    <>
      <Field invalid={errors.calendar_id !== undefined}>
        <FieldLabel>{t("terms.calendar")}</FieldLabel>
        <ChoiceSelect
          label={t("terms.calendar")}
          choices={choices}
          value={draft.calendar}
          multiple={false}
          invalid={errors.calendar_id !== undefined}
          onChange={(next) => {
            if (typeof next === "string") onChange({ calendar: next });
          }}
        />
        {errors.calendar_id === undefined ? (
          <FieldDescription>{t("terms.calendarHint")}</FieldDescription>
        ) : (
          <FieldError>{errors.calendar_id}</FieldError>
        )}
      </Field>

      <Checkbox
        checked={draft.dailyLiquidity}
        onCheckedChange={(checked) => {
          onChange({ dailyLiquidity: checked });
        }}
      >
        {t("terms.dailyLiquidity")}
      </Checkbox>

      <Field invalid={errors.redeemable_from !== undefined}>
        <FieldLabel>{t("terms.redeemableFrom")}</FieldLabel>
        <DateInput
          name="redeemable_from"
          value={draft.redeemableFrom}
          min={draft.issued}
          max={draft.matures}
          shortcuts={false}
          clearable
          onChange={(redeemableFrom) => {
            onChange({ redeemableFrom });
          }}
        />
        {errors.redeemable_from === undefined ? (
          <FieldDescription>{t("terms.redeemableFromHint")}</FieldDescription>
        ) : (
          <FieldError>{errors.redeemable_from}</FieldError>
        )}
      </Field>
    </>
  );
}
