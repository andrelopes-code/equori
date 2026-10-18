import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slotted/react/select";
import type { FilterBarOperandProps } from "@slotted/react/filter-bar";

import { useT } from "@/i18n/i18n-provider";

// The family's own boolean operand writes "true" and "false" untranslated.
export function BooleanOperand({
  label,
  size,
  value,
  onValueChange,
}: FilterBarOperandProps) {
  const t = useT();
  const items = [
    { value: "true", label: t("transactions.filter.uncategorizedYes") },
    { value: "false", label: t("transactions.filter.uncategorizedNo") },
  ];
  let selected: string | null = null;
  if (value === true) selected = "true";
  else if (value === false) selected = "false";
  return (
    <Select
      fullWidth
      size={size}
      items={items}
      value={selected}
      onValueChange={(next) => {
        onValueChange(next === "true");
      }}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
