import { Field, FieldLabel } from "@slotted/react/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slotted/react/select";

import { useT } from "@/i18n/i18n-provider";

export function recordOptions(
  records: readonly { id: string; name: string }[],
) {
  return records.map((record) => ({
    value: record.id,
    label: `${record.name} · ${record.id.slice(0, 8)}`,
  }));
}

// "None" reaches the caller as "", which a body drops and a query leaves out.
const none = "none";

export function RecordSelect({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name?: string;
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const items = [{ value: none, label: t("admin.none") }, ...options];
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        {...(name === undefined ? {} : { name })}
        items={items}
        search={items.length > 12}
        value={value === "" ? none : value}
        onValueChange={(next) => {
          onChange(typeof next === "string" && next !== none ? next : "");
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
