import { Heading, Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/ui/card-face/studio/studio-step.module.css";

interface StudioStepProps {
  number: number;
  title: string;
  value: ReactNode;
  children: ReactNode;
}

export function StudioStep({
  number,
  title,
  value,
  children,
}: StudioStepProps) {
  return (
    <section className={styles.step}>
      <div className={styles.head}>
        <Text size="xs" tone="accent" className={styles.number}>
          {String(number).padStart(2, "0")}
        </Text>
        <Heading level={3} size="lg">
          {title}
        </Heading>
        <span className={styles.value}>{value}</span>
      </div>

      {children}
    </section>
  );
}
