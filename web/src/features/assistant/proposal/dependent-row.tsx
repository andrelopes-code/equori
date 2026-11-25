import { Checkbox } from "@slotted/react/checkbox";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/proposal/decision-sheet.module.css";
import { operationIcon } from "@/features/assistant/proposal/ticket/operation-icon";
import { operationTitle } from "@/features/assistant/proposal/ticket/operation-title";
import { useT } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

interface DependentRowProps {
  proposal: Proposal;
  // The mark of the proposal it waits for.
  marked: boolean;
}

// Families read: checkbox, typography. A proposal that waits for the one above it: its mark
// follows the parent's and it executes as its own row once the server promotes it.
export function DependentRow({ proposal, marked }: DependentRowProps) {
  const t = useT();
  const title = operationTitle(proposal.preview, t);

  return (
    <div className={styles.dep}>
      <Checkbox size="sm" aria-label={title} checked={marked} disabled />

      <span className={styles.connector}>
        <span className={styles.icon14}>
          <AssistantIcon name="corner" />
        </span>
      </span>

      <span className={styles.depTitle}>
        <span className={styles.icon16}>
          <AssistantIcon name={operationIcon(proposal)} />
        </span>
        <Text className={styles.titleText} size="sm" weight="medium">
          {title}
        </Text>
      </span>

      <Text size="xs" tone="muted">
        {t("assistant.sheet.next")}
      </Text>
    </div>
  );
}
