import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { useId } from "react";
import type { ReactNode } from "react";

import styles from "@/features/transactions/account-field/account-section-list.module.css";

interface AccountOtherBlockProps {
  label: string;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

// The collapsed block "Other accounts": a header row with the label and the count, and the
// options only while open, so the arrow keys reach them only then.
export function AccountOtherBlock({
  label,
  count,
  open,
  onOpenChange,
  children,
}: AccountOtherBlockProps) {
  const labelId = useId();

  return (
    <Collapsible
      open={open}
      mount="active"
      size="sm"
      variant="framed"
      onOpenChange={onOpenChange}
    >
      <CollapsibleHeader>
        <CollapsibleTrigger>
          <span id={labelId}>{label}</span>{" "}
          <span className={styles.count}>{count}</span>
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <div role="group" aria-labelledby={labelId}>
          {children}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
