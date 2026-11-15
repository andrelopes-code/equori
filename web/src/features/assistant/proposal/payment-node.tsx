import { Text } from "@slotted/react/typography";

import {
  AssistantIcon,
  type AssistantIconName,
} from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/proposal/bodies.module.css";

interface PaymentNodeProps {
  icon: AssistantIconName;
  text: string | undefined;
}

// Families read: typography. One end of a payment: its icon tile over its name.
export function PaymentNode({ icon, text }: PaymentNodeProps) {
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
    </span>
  );
}
