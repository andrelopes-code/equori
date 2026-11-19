import { Button } from "@slotted/react/button";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import type { ReactNode, Ref } from "react";

interface OptionalFieldGroupProps {
  ref?: Ref<HTMLFieldSetElement>;
  legend: string;
  remove: string;
  onRemove: () => void;
  children: ReactNode;
}

// The open state of an optional group: its inputs under a legend and a ghost button that
// removes them.
export function OptionalFieldGroup({
  ref,
  legend,
  remove,
  onRemove,
  children,
}: OptionalFieldGroupProps) {
  return (
    <FieldGroup ref={ref} kind="section">
      <FieldGroupLegend>{legend}</FieldGroupLegend>
      <FieldGroupContent>
        <Stack gap={8}>
          {children}

          <Inline>
            <Button
              size="sm"
              variant="ghost"
              tone="secondary"
              onClick={onRemove}
            >
              {remove}
            </Button>
          </Inline>
        </Stack>
      </FieldGroupContent>
    </FieldGroup>
  );
}
