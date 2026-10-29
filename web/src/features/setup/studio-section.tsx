import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useId } from "react";
import type { ReactNode } from "react";

import styles from "@/features/setup/appearance-studio.module.css";

export interface StudioSectionProps {
  title: string;
  children: ReactNode;
}

// A run of controls in the studio's panel under a thin heading, without a card around it.
export function StudioSection({ title, children }: StudioSectionProps) {
  const id = useId();

  return (
    <section aria-labelledby={id} className={styles.section}>
      <Text size="xs" weight="medium" tone="muted" id={id}>
        {title}
      </Text>
      <Stack gap={5}>{children}</Stack>
    </section>
  );
}
