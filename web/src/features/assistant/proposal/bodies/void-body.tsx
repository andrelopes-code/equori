import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { ItemRows } from "@/features/assistant/proposal/bodies/item-rows";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface VoidBodyProps {
  preview: Preview;
}

// Families read: typography. The transaction struck through on a danger wash, then the reason.
export function VoidBody({ preview }: VoidBodyProps) {
  const t = useT();
  const valueText = useValueText();
  const reason = valueText(changeOf(preview, "reason")?.after);
  const rest = changesWithout(preview, ["reason"]);

  return (
    <div className={styles.body}>
      <ItemRows items={preview.items ?? []} struck />

      {reason !== undefined && (
        <Text size="sm" tone="muted">
          {t("assistant.body.reason", { reason })}
        </Text>
      )}

      <ProposalChanges changes={rest} />
    </div>
  );
}
