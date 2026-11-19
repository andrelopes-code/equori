import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { useState } from "react";
import type { ReactNode } from "react";

import { OptionalFieldGroup } from "@/features/calculators/calculator-frame/optional-field-group";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";

interface OptionalGroupSpec {
  // The address keys of the group's inputs; the first names the group.
  keys: string[];
  add: string;
  legend: string;
  remove: string;
  children: ReactNode;
}

interface OptionalGroupsProps {
  groups: OptionalGroupSpec[];
}

// Several optional groups: the add buttons of the closed ones stand in one row, the open ones as
// field groups above it. A group is open while any of its keys is in the address.
export function OptionalGroups({ groups }: OptionalGroupsProps) {
  const [search, setSearch] = useCalculatorSearch();
  const [added, setAdded] = useState<string[]>([]);

  const isOpen = (group: OptionalGroupSpec) =>
    added.includes(group.keys[0] ?? "") ||
    group.keys.some((key) => key in search);
  const closed = groups.filter((group) => !isOpen(group));

  function handleRemove(group: OptionalGroupSpec) {
    setSearch(Object.fromEntries(group.keys.map((key) => [key, undefined])));
    setAdded((prev) => prev.filter((name) => name !== group.keys[0]));
  }

  return (
    <>
      {groups.filter(isOpen).map((group) => (
        <OptionalFieldGroup
          key={group.keys[0]}
          legend={group.legend}
          remove={group.remove}
          onRemove={() => {
            handleRemove(group);
          }}
        >
          {group.children}
        </OptionalFieldGroup>
      ))}

      {closed.length > 0 && (
        <Inline gap={2}>
          {closed.map((group) => (
            <Button
              key={group.keys[0]}
              size="sm"
              variant="outline"
              tone="secondary"
              start={<Glyph name="plus" />}
              onClick={() => {
                setAdded((prev) => [...prev, group.keys[0] ?? ""]);
              }}
            >
              {group.add}
            </Button>
          ))}
        </Inline>
      )}
    </>
  );
}
