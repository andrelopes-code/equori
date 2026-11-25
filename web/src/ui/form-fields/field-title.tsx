import type { ReactNode } from "react";

import { FieldHeader, FieldHelp, FieldLabel } from "@slotted/react/field";

interface FieldTitleProps {
  label: ReactNode;
  // The definition of a term a reader may not know (docs/contributing/forms.md, F8).
  help?: ReactNode;
  // Places the label where a layout of the application's own puts it (a row, a stop).
  className?: string | undefined;
}

// A field's label, with the help button beside it when the label names a term to define.
export function FieldTitle({ label, help, className }: FieldTitleProps) {
  if (help === undefined)
    return <FieldLabel className={className}>{label}</FieldLabel>;

  return (
    <FieldHeader className={className}>
      <FieldLabel>{label}</FieldLabel>
      <FieldHelp>{help}</FieldHelp>
    </FieldHeader>
  );
}
