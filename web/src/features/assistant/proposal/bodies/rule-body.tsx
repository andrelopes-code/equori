import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface RuleBodyProps {
  preview: Preview;
}

// Families read: typography. When the pattern matches, then the category; the pattern in the
// monospace font. Any other change stays a field row.
export function RuleBody({ preview }: RuleBodyProps) {
  const t = useT();
  const valueText = useValueText();
  const pattern = valueText(changeOf(preview, "pattern")?.after);
  const category = valueText(changeOf(preview, "category")?.after);
  const rest = changesWithout(preview, ["pattern", "category"]);

  return (
    <div className={styles.body}>
      {(pattern !== undefined || category !== undefined) && (
        <div className={styles.rule}>
          {pattern !== undefined && (
            <div className={styles.ruleRow}>
              <Text className={styles.key}>{t("assistant.body.when")}</Text>
              <Text size="sm" tone="muted">
                {t("assistant.body.matches")}
              </Text>
              <code className={styles.code}>{pattern}</code>
            </div>
          )}

          {category !== undefined && (
            <div className={styles.ruleRow}>
              <Text className={styles.key}>{t("assistant.body.then")}</Text>
              <Text size="sm" weight="medium" className={styles.then}>
                {category}
              </Text>
            </div>
          )}
        </div>
      )}

      <ProposalChanges changes={rest} />
    </div>
  );
}
