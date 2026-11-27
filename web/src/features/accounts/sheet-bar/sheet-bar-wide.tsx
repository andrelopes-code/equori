import { Inline } from "@slotted/react/inline";
import type { ReactNode } from "react";

import { BasisControl } from "@/features/accounts/sheet-bar/basis-control";
import styles from "@/features/accounts/sheet-bar/sheet-bar.module.css";
import type { SheetBarProps } from "@/features/accounts/sheet-bar/sheet-bar-props";
import { SheetSegments } from "@/features/accounts/sheet-bar/sheet-segments";

interface SheetBarWideProps extends Omit<SheetBarProps, "date" | "closed"> {
  date: ReactNode;
  closed: ReactNode;
}

// Every control in one bar: the grouping and the order, then the date, the basis and the
// closed accounts.
export function SheetBarWide({
  date,
  closed,
  basis,
  group,
  order,
  onBasisChange,
  onGroupChange,
  onOrderChange,
}: SheetBarWideProps) {
  return (
    <div className={styles.wide}>
      <SheetSegments
        group={group}
        order={order}
        onGroupChange={onGroupChange}
        onOrderChange={onOrderChange}
      />

      <Inline gap={6} wrap="wrap" align="center">
        <Inline gap={3}>
          <div className={styles.date}>{date}</div>
          <BasisControl value={basis} onChange={onBasisChange} />
        </Inline>
        {closed}
      </Inline>
    </div>
  );
}
