import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";

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

// Families read: description-list. Each value a proposal writes, its field beside it.
export function ProposalChanges({ changes }: ProposalChangesProps) {
  const t = useT();
  const valueText = useValueText();

  return (
    <DescriptionList layout="stack" columns={2} className={styles.changes}>
      {changes.map((change, i) => {
        const fieldKey = catalogKey(`assistant.field.${change.field}`);

        return (
          <DescriptionListItem key={`${change.field}-${String(i)}`}>
            <DescriptionListTerm>
              {fieldKey === undefined ? change.field : t(fieldKey)}
            </DescriptionListTerm>
            <DescriptionListDescription>
              <ProposalChange
                before={valueText(change.before)}
                after={valueText(change.after)}
              />
            </DescriptionListDescription>
          </DescriptionListItem>
        );
      })}
    </DescriptionList>
  );
}
