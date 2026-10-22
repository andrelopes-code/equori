import type { Entity } from "@slotted/core/entity-picker";
import {
  EntityPickerOptionDescription,
  EntityPickerOptionLabel,
  EntityPickerOptionMedia,
  EntityPickerOptionMeta,
} from "@slotted/react/entity-picker";
import { Highlight } from "@slotted/react/highlight";

import { AccountMark } from "@/features/accounts/account-mark";

// Bank logos are drawn for a white ground; the option draws the logo on the white plate the
// account marks use.
export function InstitutionOption({
  entity,
  query,
}: {
  entity: Entity;
  query: string;
}) {
  return (
    <>
      <EntityPickerOptionMedia>
        <AccountMark
          shape="square"
          name={entity.label}
          logo={entity.avatar?.src}
          size="sm"
        />
      </EntityPickerOptionMedia>
      <EntityPickerOptionLabel>
        <Highlight text={entity.label} query={query} />
      </EntityPickerOptionLabel>
      {entity.description !== undefined && (
        <EntityPickerOptionDescription>
          {entity.description}
        </EntityPickerOptionDescription>
      )}
      {entity.meta !== undefined && (
        <EntityPickerOptionMeta>{entity.meta}</EntityPickerOptionMeta>
      )}
    </>
  );
}
