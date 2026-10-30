import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/assistant-panel.module.css";
import { catalogKey } from "@/features/assistant/catalog-key";
import { ProposalChange } from "@/features/assistant/proposal-change";
import { useValueText } from "@/features/assistant/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Change = components["schemas"]["AssistantPreview"]["changes"][number];

interface ProposalChangesProps {
  changes: readonly Change[];
}

// Families read: typography. Each value a proposal writes on a row of its own, the field at the
// start and the value at the end of the card (P14).
// Workaround for Slotted issue #56: DescriptionList stacks its pairs in a container under 26rem, the
// width of the assistant's pane, so the list is a dl of its own.
export function ProposalChanges({ changes }: ProposalChangesProps) {
  const t = useT();
  const valueText = useValueText();

  return (
    <dl className={styles.changes}>
      {changes.map((change, i) => {
        const fieldKey = catalogKey(`assistant.field.${change.field}`);

        return (
          <div key={`${change.field}-${String(i)}`} className={styles.field}>
            <dt>
              <Text size="sm" tone="muted">
                {fieldKey === undefined ? change.field : t(fieldKey)}
              </Text>
            </dt>
            <dd className={styles.fieldValue}>
              <ProposalChange
                before={valueText(change.before)}
                after={valueText(change.after)}
              />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
