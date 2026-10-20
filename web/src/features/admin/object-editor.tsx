import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Grid } from "@slotted/react/grid";
import { Stack } from "@slotted/react/stack";

import { isMoney } from "@/features/admin/draft";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { ValueEditor } from "@/features/admin/value-editor";

function isNested(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !isMoney(value) &&
    !(Array.isArray(value) && value.every((item) => typeof item !== "object"))
  );
}

// Plain fields and money share a grid; nested objects and record lists follow it at full width.
export function ObjectEditor({
  name,
  path,
  value,
  onChange,
  ctx,
}: {
  name?: string;
  path?: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  ctx: AdminContext;
}) {
  const entries = Object.entries(value);
  const editor = ([key, item]: [string, unknown]) => (
    <ValueEditor
      key={key}
      name={key}
      path={path === undefined ? key : `${path}.${key}`}
      value={item}
      onChange={(next) => {
        onChange({ ...value, [key]: next });
      }}
      ctx={ctx}
    />
  );
  const nested = entries.filter(([, item]) => isNested(item));
  const body = (
    <Stack gap={5}>
      <Grid gap={4} minItemWidth="sm">
        {entries.filter(([, item]) => !isNested(item)).map(editor)}
      </Grid>
      {nested.map(editor)}
    </Stack>
  );
  if (name === undefined) return body;
  return (
    <FieldGroup>
      <FieldGroupLegend>{name}</FieldGroupLegend>
      <FieldGroupContent>{body}</FieldGroupContent>
    </FieldGroup>
  );
}
