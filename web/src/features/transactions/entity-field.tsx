import { Field, FieldLabel } from "@slotted/react/field";
import type { Entity } from "@slotted/react/entity-picker";

import { EntitySelect } from "@/features/transactions/entity-select";
import { PhoneEntityPicker } from "@/features/transactions/phone-entity-picker";
import { useViewport } from "@/ui/use-viewport";

export function EntityField(props: {
  label: string;
  kind: string;
  entities: Entity[];
  value: string;
  onChange: (id: string, entity: Entity | undefined) => void;
  onCreate?: (query: string) => Entity;
}) {
  const phone = useViewport() === "phone";
  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      {phone ? <PhoneEntityPicker {...props} /> : <EntitySelect {...props} />}
    </Field>
  );
}
