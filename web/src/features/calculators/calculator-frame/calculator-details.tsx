import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleHeader,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import type { ReactNode } from "react";

interface CalculatorDetailsProps {
  title: string;
  // What the closed details hold, written beside the title ("360 meses, Price e SAC").
  size: string;
  children: ReactNode;
}

export function CalculatorDetails({
  title,
  size,
  children,
}: CalculatorDetailsProps) {
  return (
    <Collapsible>
      <CollapsibleHeader>
        <CollapsibleTrigger description={size}>{title}</CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>{children}</CollapsiblePanel>
    </Collapsible>
  );
}
