import { Button } from "@slotted/react/button";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { ObjectEditor } from "@/features/admin/object-editor";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useT } from "@/i18n/i18n-provider";

// A new item copies the shape of the first item the list started with.
export function ArrayEditor({
  name,
  path,
  value,
  onChange,
  ctx,
}: {
  name: string;
  path: string;
  value: Record<string, unknown>[];
  onChange: (value: Record<string, unknown>[]) => void;
  ctx: AdminContext;
}) {
  const t = useT();
  const [blank] = useState(() => structuredClone(value[0] ?? {}));
  const itemName = (index: number) => `${name}[${String(index)}]`;
  return (
    <Stack gap={5}>
      {value.map((item, index) => (
        <FieldGroup key={index}>
          <FieldGroupLegend>{itemName(index)}</FieldGroupLegend>
          <FieldGroupContent>
            <Stack gap={3}>
              <ObjectEditor
                path={`${path}[${String(index)}]`}
                value={item}
                onChange={(next) => {
                  onChange(value.map((old, i) => (i === index ? next : old)));
                }}
                ctx={ctx}
              />
              {value.length > 1 && (
                <Inline justify="end">
                  <Button
                    size="sm"
                    tone="danger"
                    variant="ghost"
                    onClick={() => {
                      onChange(value.filter((_, i) => i !== index));
                    }}
                  >
                    {t("admin.list.remove", {
                      name: `${name}[${String(index)}]`,
                    })}
                  </Button>
                </Inline>
              )}
            </Stack>
          </FieldGroupContent>
        </FieldGroup>
      ))}
      <Inline>
        <Button
          size="sm"
          tone="secondary"
          variant="outline"
          onClick={() => {
            onChange([...value, structuredClone(blank)]);
          }}
        >
          {t("admin.list.add", { name })}
        </Button>
      </Inline>
    </Stack>
  );
}
