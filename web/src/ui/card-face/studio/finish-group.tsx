import { Text } from "@slotted/react/typography";
import { useId } from "react";
import type { ReactNode } from "react";

import styles from "@/ui/card-face/studio/finish-options.module.css";

interface FinishGroupProps {
  label: string;
  children: ReactNode;
}

export function FinishGroup({ label, children }: FinishGroupProps) {
  const labelId = useId();

  return (
    <div className={styles.group}>
      <Text id={labelId} weight="medium" size="sm">
        {label}
      </Text>

      <div
        className={styles.options}
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {children}
      </div>
    </div>
  );
}
