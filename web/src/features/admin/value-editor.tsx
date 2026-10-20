import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { ArrayEditor } from "@/features/admin/array-editor";
import { isMoney } from "@/features/admin/draft";
import { LeafEditor } from "@/features/admin/leaf-editor";
import { MoneyEditor } from "@/features/admin/money-editor";
import { ObjectEditor } from "@/features/admin/object-editor";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useT } from "@/i18n/i18n-provider";

function isRecordList(value: unknown[]): value is Record<string, unknown>[] {
  return (
    value.length > 0 &&
    value.every((item) => typeof item === "object" && item !== null)
  );
}

export function ValueEditor({
  name,
  path,
  value,
  onChange,
  ctx,
}: {
  name: string;
  path: string;
  value: unknown;
  onChange: (value: unknown) => void;
  ctx: AdminContext;
}) {
  const t = useT();
  if (isMoney(value)) {
    return (
      <MoneyEditor name={name} path={path} value={value} onChange={onChange} />
    );
  }
  if (Array.isArray(value)) {
    if (isRecordList(value)) {
      return (
        <ArrayEditor
          name={name}
          path={path}
          value={value}
          onChange={onChange}
          ctx={ctx}
        />
      );
    }
    return (
      <Field>
        <FieldLabel>{name}</FieldLabel>
        <TextField
          name={path}
          value={value.join(", ")}
          onValueChange={(text) => {
            onChange(
              text
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item !== ""),
            );
          }}
        />
        <FieldDescription>{t("admin.list.help")}</FieldDescription>
      </Field>
    );
  }
  if (typeof value === "object" && value !== null) {
    return (
      <ObjectEditor
        name={name}
        path={path}
        value={value as Record<string, unknown>}
        onChange={onChange}
        ctx={ctx}
      />
    );
  }
  return (
    <LeafEditor
      name={name}
      path={path}
      value={value}
      onChange={onChange}
      ctx={ctx}
    />
  );
}
