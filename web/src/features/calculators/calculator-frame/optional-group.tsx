import { Button } from "@slotted/react/button";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Glyph } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";
import type { ReactNode } from "react";

import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";

interface OptionalGroupProps {
  // The address keys of the group's inputs; the group is open while any of them is present.
  keys: string[];
  add: string;
  legend: string;
  remove: string;
  children: ReactNode;
}

export function OptionalGroup({
  keys,
  add,
  legend,
  remove,
  children,
}: OptionalGroupProps) {
  const [search, setSearch] = useCalculatorSearch();
  const [added, setAdded] = useState(false);

  const open = added || keys.some((key) => key in search);

  function handleRemove() {
    setSearch(Object.fromEntries(keys.map((key) => [key, undefined])));
    setAdded(false);
  }

  if (!open) {
    return (
      <Inline gap={2}>
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          start={<Glyph name="plus" />}
          onClick={() => {
            setAdded(true);
          }}
        >
          {add}
        </Button>
      </Inline>
    );
  }

  return (
    <FieldGroup kind="section">
      <FieldGroupLegend>{legend}</FieldGroupLegend>
      <FieldGroupContent>
        <Stack gap={8}>
          {children}

          <Inline>
            <Button
              size="sm"
              variant="ghost"
              tone="secondary"
              onClick={handleRemove}
            >
              {remove}
            </Button>
          </Inline>
        </Stack>
      </FieldGroupContent>
    </FieldGroup>
  );
}
