import { parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import type { Entity } from "@slotted/react/entity-picker";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TagsInput } from "@slotted/react/tags-input";
import { TextField } from "@slotted/react/text-field";
import type { Dispatch } from "react";

import type { components } from "@/api/schema.gen";
import { EntityField } from "@/features/transactions/entity-field";
import type {
  FormAction,
  FormState,
} from "@/features/transactions/transaction-form-reducer";
import { useT } from "@/i18n/i18n-provider";

// Stands for a payee typed but not stored yet; the correction request creates it first.
const newPayeeID = "new-payee";

// Date, payee, description and tags: the fields every transaction form shares.
export function TransactionMetaFields({
  state,
  dispatch,
  payees,
  errors,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  payees: components["schemas"]["Payee"][];
  errors: { date?: string; description?: string };
}) {
  const t = useT();
  const payeeEntities: Entity[] = payees.map((p) => ({
    id: p.id,
    label: p.name,
  }));
  if (
    state.payeeName !== undefined &&
    !payees.some((p) => p.id === state.payeeId)
  ) {
    payeeEntities.push({
      id: state.payeeId ?? newPayeeID,
      label: state.payeeName,
    });
  }
  return (
    <>
      <Field invalid={errors.date !== undefined}>
        <FieldLabel>{t("transactions.new.date")}</FieldLabel>
        <DatePicker
          value={parseISODate(state.date)}
          onValueChange={(next) => {
            dispatch({
              type: "date",
              date: next !== null && "year" in next ? toISODate(next) : "",
            });
          }}
        />
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>
      <EntityField
        label={t("transactions.filter.payee")}
        kind="payee"
        entities={payeeEntities}
        value={
          state.payeeId ?? (state.payeeName === undefined ? "" : newPayeeID)
        }
        onCreate={(query) => {
          dispatch({ type: "payee", name: query });
          return { id: newPayeeID, label: query };
        }}
        onChange={(id) => {
          if (id === newPayeeID) return;
          dispatch(id === "" ? { type: "payee" } : { type: "payee", id });
        }}
      />
      <Field invalid={errors.description !== undefined}>
        <FieldLabel>{t("transactions.new.description")}</FieldLabel>
        <TextField
          value={state.description}
          onValueChange={(description) => {
            dispatch({ type: "description", description });
          }}
        />
        {errors.description !== undefined && (
          <FieldError>{errors.description}</FieldError>
        )}
      </Field>
      <Field>
        <FieldLabel>{t("transactions.new.tags")}</FieldLabel>
        <TagsInput
          value={state.tags}
          onValueChange={(tags) => {
            dispatch({ type: "tags", tags: [...tags] });
          }}
        />
      </Field>
    </>
  );
}
