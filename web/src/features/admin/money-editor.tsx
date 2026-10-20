import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

interface MoneyDraft {
  amount: number | string;
  currency: string;
}

// Two cells of the object's grid: the decimal amount, then its currency.
export function MoneyEditor({
  name,
  path,
  value,
  onChange,
}: {
  name: string;
  path: string;
  value: MoneyDraft;
  onChange: (value: MoneyDraft) => void;
}) {
  const currencyLabel = `${name}.currency`;
  return (
    <>
      <Field>
        <FieldLabel>{name}</FieldLabel>
        <TextField
          name={`${path}.amount`}
          inputMode="decimal"
          value={String(value.amount)}
          onValueChange={(amount) => {
            onChange({ ...value, amount });
          }}
        />
      </Field>
      <Field>
        <FieldLabel>{currencyLabel}</FieldLabel>
        <TextField
          name={`${path}.currency`}
          value={value.currency}
          onValueChange={(currency) => {
            onChange({ ...value, currency });
          }}
        />
      </Field>
    </>
  );
}
