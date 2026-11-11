import {
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import type { ReactNode } from "react";

export function FactItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DescriptionListItem>
      <DescriptionListTerm>{label}</DescriptionListTerm>
      <DescriptionListDescription>{children}</DescriptionListDescription>
    </DescriptionListItem>
  );
}
