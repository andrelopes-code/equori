import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { DateEditor } from "@/features/admin/date-editor";
import { fieldKind } from "@/features/admin/draft";
import { MonthSelect } from "@/features/admin/month-select";
import { RecordSelect, recordOptions } from "@/features/admin/record-select";
import type { AdminContext } from "@/features/admin/use-admin-context";

// name is the key the value has in its object; path is the control's name, which a
// problem's field errors are keyed by.
export function LeafEditor({
  name,
  path = name,
  value,
  onChange,
  ctx,
}: {
  name: string;
  path?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  ctx: AdminContext;
}) {
  if (typeof value === "boolean") {
    return (
      <Checkbox name={path} checked={value} onCheckedChange={onChange}>
        {name}
      </Checkbox>
    );
  }
  // A leaf holds text or a number; anything else edits as empty text.
  const text =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const field = fieldKind(name, value);
  const records = {
    account: ctx.accounts,
    payee: ctx.payees,
    institution: ctx.institutions,
  };
  switch (field.kind) {
    case "enum":
      return (
        <RecordSelect
          name={path}
          label={name}
          options={field.options.map((option) => ({
            value: option,
            label: option,
          }))}
          value={text}
          onChange={onChange}
        />
      );
    case "account":
    case "payee":
    case "institution":
      return (
        <RecordSelect
          name={path}
          label={name}
          options={recordOptions(records[field.kind])}
          value={text}
          onChange={onChange}
        />
      );
    case "date":
      return (
        <DateEditor name={path} label={name} value={text} onChange={onChange} />
      );
    case "month":
      return (
        <MonthSelect
          name={path}
          label={name}
          value={text}
          onChange={onChange}
        />
      );
    case "text":
      return (
        <Field>
          <FieldLabel>{name}</FieldLabel>
          <TextField name={path} value={text} onValueChange={onChange} />
        </Field>
      );
  }
}
