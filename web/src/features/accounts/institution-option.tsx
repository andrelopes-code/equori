import type { Entity } from "@slotted/core/entity-picker";
import { Highlight } from "@slotted/react/highlight";

import { AccountMark } from "@/features/accounts/account-mark";

// Workaround for Slotted finding "an avatar paints its tone behind a loaded picture". Bank logos
// are drawn for a white ground; on the avatar's tinted ground in the dark scheme a dark logo
// disappears. The option draws the logo on the white plate the account marks use, in the parts
// the family lays out. The family places the parts by their data-part-* attribute, not by the
// data-part its renderOption example sets (Slotted finding "renderOption example sets data-part,
// the layout reads data-part-*").
export function InstitutionOption({
  entity,
  query,
}: {
  entity: Entity;
  query: string;
}) {
  return (
    <>
      <span data-part="media" data-part-media="">
        <AccountMark
          shape="square"
          name={entity.label}
          logo={entity.avatar?.src}
          size="sm"
        />
      </span>
      <span data-part="label" data-part-label="">
        <Highlight text={entity.label} query={query} />
      </span>
      {entity.description !== undefined && (
        <span data-part="description" data-part-description="">
          {entity.description}
        </span>
      )}
      {entity.meta !== undefined && (
        <span data-part="meta" data-part-meta="">
          {entity.meta}
        </span>
      )}
    </>
  );
}
