import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";

import type {
  Adjustment,
  CardSetupDraft,
} from "@/features/accounts/account-draft";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import widths from "@/ui/field-width.module.css";
import { FormRow } from "@/ui/form-row";

export type BillingFields = Pick<
  CardSetupDraft,
  | "closingMode"
  | "closingDay"
  | "closingDaysBeforeDue"
  | "dueDay"
  | "closingAdjustment"
  | "dueDateAdjustment"
  | "assignment"
>;

const adjustments: readonly Adjustment[] = [
  "none",
  "following",
  "preceding",
  "modified_following",
];

export const adjustmentLabel: Record<Adjustment, MessageKey> = {
  none: "billing.adjustment.none",
  following: "billing.adjustment.following",
  preceding: "billing.adjustment.preceding",
  modified_following: "billing.adjustment.modified_following",
};

function days(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
}

// The fields of a billing cycle rule (A87), keyed by the request's field names (FM-02).
export function BillingRuleFields({
  value,
  onChange,
  errors,
}: {
  value: BillingFields;
  onChange: (next: BillingFields) => void;
  errors: Record<string, string>;
}) {
  const t = useT();
  const set = (patch: Partial<BillingFields>) => {
    onChange({ ...value, ...patch });
  };
  const adjustmentChoices = adjustments.map((a) => ({
    value: a,
    label: t(adjustmentLabel[a]),
  }));
  return (
    // Fields 1.5rem apart, as FormLayout spaces them (docs/contributing/forms.md, F5).
    <Stack gap={8}>
      <Field>
        <FieldLabel>{t("accountForm.closingMode")}</FieldLabel>
        <Inline>
          <SegmentedControl
            aria-label={t("accountForm.closingMode")}
            value={value.closingMode}
            onValueChange={(mode) => {
              if (mode === "day" || mode === "before_due")
                set({ closingMode: mode });
            }}
          >
            <Segment value="day">{t("billing.mode.day")}</Segment>
            <Segment value="before_due">{t("billing.mode.before_due")}</Segment>
          </SegmentedControl>
        </Inline>
      </Field>
      <FormRow>
        {value.closingMode === "day" ? (
          <Field
            className={widths.medium}
            invalid={errors.closing_day !== undefined}
            required
          >
            <FieldLabel>{t("accountForm.closingDay")}</FieldLabel>
            <ChoiceSelect
              label={t("accountForm.closingDay")}
              choices={days(31)}
              value={
                value.closingDay === null ? null : String(value.closingDay)
              }
              multiple={false}
              invalid={errors.closing_day !== undefined}
              onChange={(next) => {
                set({
                  closingDay: typeof next === "string" ? Number(next) : null,
                });
              }}
            />
            {errors.closing_day !== undefined && (
              <FieldError>{errors.closing_day}</FieldError>
            )}
          </Field>
        ) : (
          <Field
            className={widths.medium}
            invalid={errors.closing_days_before_due !== undefined}
            required
          >
            <FieldLabel>{t("accountForm.daysBeforeDue")}</FieldLabel>
            <ChoiceSelect
              label={t("accountForm.daysBeforeDue")}
              choices={days(28)}
              value={
                value.closingDaysBeforeDue === null
                  ? null
                  : String(value.closingDaysBeforeDue)
              }
              multiple={false}
              invalid={errors.closing_days_before_due !== undefined}
              onChange={(next) => {
                set({
                  closingDaysBeforeDue:
                    typeof next === "string" ? Number(next) : null,
                });
              }}
            />
            {errors.closing_days_before_due !== undefined && (
              <FieldError>{errors.closing_days_before_due}</FieldError>
            )}
          </Field>
        )}
        <Field
          className={widths.medium}
          invalid={errors.due_day !== undefined}
          required
        >
          <FieldLabel>{t("accountForm.dueDay")}</FieldLabel>
          <ChoiceSelect
            label={t("accountForm.dueDay")}
            choices={days(31)}
            value={value.dueDay === null ? null : String(value.dueDay)}
            multiple={false}
            invalid={errors.due_day !== undefined}
            onChange={(next) => {
              set({ dueDay: typeof next === "string" ? Number(next) : null });
            }}
          />
          {errors.due_day !== undefined && (
            <FieldError>{errors.due_day}</FieldError>
          )}
        </Field>
      </FormRow>
      <FormRow>
        <Field className={widths.medium}>
          <FieldLabel>{t("accountForm.closingAdjustment")}</FieldLabel>
          <ChoiceSelect
            label={t("accountForm.closingAdjustment")}
            choices={adjustmentChoices}
            value={value.closingAdjustment}
            multiple={false}
            onChange={(next) => {
              if (typeof next === "string") {
                set({ closingAdjustment: next as Adjustment });
              }
            }}
          />
        </Field>
        <Field className={widths.medium}>
          <FieldLabel>{t("accountForm.dueAdjustment")}</FieldLabel>
          <ChoiceSelect
            label={t("accountForm.dueAdjustment")}
            choices={adjustmentChoices}
            value={value.dueDateAdjustment}
            multiple={false}
            onChange={(next) => {
              if (typeof next === "string") {
                set({ dueDateAdjustment: next as Adjustment });
              }
            }}
          />
        </Field>
      </FormRow>
      <Field>
        <FieldLabel>{t("accountForm.assignment")}</FieldLabel>
        <Inline>
          <SegmentedControl
            aria-label={t("accountForm.assignment")}
            value={value.assignment}
            onValueChange={(next) => {
              if (next === "next" || next === "closing")
                set({ assignment: next });
            }}
          >
            <Segment value="next">{t("billing.assignment.next")}</Segment>
            <Segment value="closing">{t("billing.assignment.closing")}</Segment>
          </SegmentedControl>
        </Inline>
        <FieldDescription>{t("accountForm.assignmentHint")}</FieldDescription>
      </Field>
    </Stack>
  );
}
