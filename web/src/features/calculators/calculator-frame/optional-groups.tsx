import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { OptionalFieldGroup } from "@/features/calculators/calculator-frame/optional-field-group";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";

interface OptionalGroupSpec<K extends string> {
  // The address keys of the group's inputs; the first names the group. NoInfer: the keys are
  // checked against the screen's addressKeys, they do not widen them.
  keys: readonly NoInfer<K>[];
  add: string;
  legend: string;
  remove: string;
  children: ReactNode;
}

interface OptionalGroupsProps<K extends string> {
  groups: OptionalGroupSpec<K>[];
  // The screen's addressKeys: a key of a group outside it does not compile.
  addressKeys: readonly K[];
}

// Where focus goes after the next render: the first control of a group that opened, or the add
// button of a group that closed.
interface FocusTarget {
  group: string;
  to: "fields" | "add";
}

const controlSelector = "input, select, textarea, button";

// Several optional groups: the add buttons of the closed ones stand in one row, the open ones as
// field groups above it. A group is open while any of its keys is in the address.
export function OptionalGroups<K extends string>({
  groups,
  addressKeys,
}: OptionalGroupsProps<K>) {
  const [search, setSearch] = useCalculatorSearch(addressKeys);
  const [added, setAdded] = useState<string[]>([]);
  const fields = useRef(new Map<string, HTMLElement>());
  const adds = useRef(new Map<string, HTMLElement>());
  const target = useRef<FocusTarget | null>(null);

  useEffect(() => {
    const next = target.current;
    if (next === null) return;
    target.current = null;
    const el =
      next.to === "add"
        ? adds.current.get(next.group)
        : fields.current
            .get(next.group)
            ?.querySelector<HTMLElement>(controlSelector);
    el?.focus();
  });

  const isOpen = (group: OptionalGroupSpec<K>) =>
    added.includes(nameOf(group)) || group.keys.some((key) => key in search);
  const closed = groups.filter((group) => !isOpen(group));

  function handleAdd(group: OptionalGroupSpec<K>) {
    target.current = { group: nameOf(group), to: "fields" };
    setAdded((prev) => [...prev, nameOf(group)]);
  }

  function handleRemove(group: OptionalGroupSpec<K>) {
    target.current = { group: nameOf(group), to: "add" };
    setSearch(
      Object.fromEntries(group.keys.map((key) => [key, undefined])) as Partial<
        Record<K, undefined>
      >,
    );
    setAdded((prev) => prev.filter((name) => name !== nameOf(group)));
  }

  return (
    <>
      {groups.filter(isOpen).map((group) => (
        <OptionalFieldGroup
          key={nameOf(group)}
          ref={(el) => {
            keep(fields.current, nameOf(group), el);
          }}
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
              key={nameOf(group)}
              ref={(el) => {
                keep(adds.current, nameOf(group), el);
              }}
              size="sm"
              variant="outline"
              tone="secondary"
              start={<Glyph name="plus" />}
              onClick={() => {
                handleAdd(group);
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

function nameOf(group: { keys: readonly string[] }): string {
  return group.keys[0] ?? "";
}

function keep(
  map: Map<string, HTMLElement>,
  name: string,
  el: HTMLElement | null,
) {
  if (el === null) map.delete(name);
  else map.set(name, el);
}
