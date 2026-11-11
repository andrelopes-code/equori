import type { ReactNode } from "react";

import { FieldHeader, FieldHelp, FieldLabel } from "@slotted/react/field";

interface FieldTitleProps {
  label: ReactNode;
  // The definition of a term a reader may not know (docs/contributing/forms.md, F8).
  help?: ReactNode;
}

// A field's label, with the help button beside it when the label names a term to define.
export function FieldTitle({ label, help }: FieldTitleProps) {
  if (help === undefined) return <FieldLabel>{label}</FieldLabel>;

  return (
    <FieldHeader>
      <FieldLabel>{label}</FieldLabel>
      <FieldHelp>{help}</FieldHelp>
    </FieldHeader>
  );
}
