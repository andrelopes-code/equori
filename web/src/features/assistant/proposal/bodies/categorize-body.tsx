import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { ItemRows } from "@/features/assistant/proposal/bodies/item-rows";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Preview = components["schemas"]["AssistantPreview"];

interface CategorizeBodyProps {
  preview: Preview;
}

// Families read: typography. From the categories the transactions leave to the one they enter,
// then the moved transactions (spec 2026-11-15, section 7).
export function CategorizeBody({ preview }: CategorizeBodyProps) {
  const t = useT();
  const valueText = useValueText();
  const items = preview.items ?? [];
  const uncategorized = t("assistant.body.uncategorized");
  const leaving = new Set(items.map((item) => item.category ?? uncategorized));
  const from = leaving.size > 0 ? [...leaving].join(", ") : uncategorized;
  const to = valueText(changeOf(preview, "category")?.after);
  const rest = changesWithout(preview, ["category"]);

  return (
    <div className={styles.body}>
      <div className={styles.move}>
        <div className={styles.moveRow}>
          <Text className={styles.key}>{t("assistant.body.from")}</Text>
          <span className={cx(styles.chip, styles.chipFrom)}>
            <Text size="sm" className={styles.chipText}>
              {valueText({ text: from })}
            </Text>
          </span>
        </div>

        <div className={styles.moveRow}>
          <Text className={styles.key}>{t("assistant.body.to")}</Text>
          <span className={cx(styles.chip, styles.chipTo)}>
            <span className={styles.icon14}>
              <AssistantIcon name="tag" />
            </span>
            <Text size="sm" className={styles.chipText}>
              {to}
            </Text>
          </span>
        </div>
      </div>

      <ItemRows items={items} />

      <ProposalChanges changes={rest} />
    </div>
  );
}
