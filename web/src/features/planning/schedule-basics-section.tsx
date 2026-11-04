import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import {
  takesCategory,
  type ScheduleDraft,
  type ScheduleKind,
} from "@/features/planning/schedule-draft";
import { kindLabel } from "@/features/planning/schedule-words";
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import widths from "@/ui/field-width.module.css";
import { MoneyInput } from "@/ui/money-input";

const kinds = Object.keys(kindLabel) as ScheduleKind[];

interface ScheduleBasicsSectionProps {
  draft: ScheduleDraft;
  patch: (change: Partial<ScheduleDraft>) => void;
  errors: Record<string, string>;
}

// The kind, the description and the amount of a schedule.
export function ScheduleBasicsSection({
  draft,
  patch,
  errors,
}: ScheduleBasicsSectionProps) {
  const t = useT();
  const api = useApi();
  const scale = useScale();
  const settings = useQuery(settingsQuery(api));
  const currency = settings.data?.base_currency;

  return (
    <>
      <Field required>
        <FieldLabel>{t("schedule.kind")}</FieldLabel>
        <ChoiceSelect
          className={widths.medium}
          label={t("schedule.kind")}
          multiple={false}
          value={draft.kind}
          choices={kinds.map((k) => ({
            value: k,
            label: t(kindLabel[k]),
          }))}
          onChange={(next) => {
            const chosen = kinds.find((k) => k === next);
            if (chosen === undefined) return;
            if (takesCategory(chosen) !== takesCategory(draft.kind)) {
              patch({ kind: chosen, counterpartID: null });
              return;
            }
            patch({ kind: chosen });
          }}
        />
      </Field>

      <Field invalid={errors.description !== undefined} required>
        <FieldLabel>{t("schedule.description")}</FieldLabel>
        <TextField
          name="description"
          maxLength={200}
          value={draft.description}
          onChange={(event) => {
            patch({ description: event.target.value });
          }}
        />
        {errors.description !== undefined && (
          <FieldError>{errors.description}</FieldError>
        )}
      </Field>

      <Field invalid={errors.amount !== undefined} required>
        <FieldLabel>{t("schedule.amount")}</FieldLabel>
        {currency !== undefined && scale !== null && (
          <MoneyInput
            size="field"
            className={widths.medium}
            value={draft.amount}
            onChange={(amount) => {
              patch({ amount });
            }}
            currency={currency}
            scale={scale(currency)}
            sign={draft.kind === "income" ? "income" : "expense"}
          />
        )}

        {errors.amount !== undefined && (
          <FieldError>{errors.amount}</FieldError>
        )}
      </Field>
    </>
  );
}
