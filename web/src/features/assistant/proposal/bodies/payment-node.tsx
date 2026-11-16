import { Text } from "@slotted/react/typography";

import {
  AssistantIcon,
  type AssistantIconName,
} from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";

interface PaymentNodeProps {
  icon: AssistantIconName;
  text: string | undefined;
  // A second, smaller line under the name (the statement under its card).
  caption?: string | undefined;
}

// Families read: typography. One end of a payment: its icon tile over its name and caption.
export function PaymentNode({ icon, text, caption }: PaymentNodeProps) {
  return (
    <span className={styles.node}>
      <span className={styles.nodeIcon}>
        <span className={styles.icon14}>
          <AssistantIcon name={icon} />
        </span>
      </span>
      <Text size="sm" weight="medium" className={styles.ellipsis}>
        {text}
      </Text>
      {caption !== undefined && (
        <Text size="xs" tone="muted" className={styles.ellipsis}>
          {caption}
        </Text>
      )}
    </span>
  );
}
